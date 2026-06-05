"""
文件指纹数据库模块
维护本地文件的内容哈希，用于差异备份判断
"""

import sqlite3
import hashlib
import os
import shutil
from datetime import datetime
from typing import Optional, Tuple, List, Dict
from .logger import get_logger

logger = get_logger("fingerprint")


class FileFingerprint:
    def __init__(
        self,
        file_path: str,
        file_hash: str,
        file_size: int,
        modified_time: float,
        task_name: str,
        last_backup_time: Optional[float] = None,
        version: int = 1
    ):
        self.file_path = file_path
        self.file_hash = file_hash
        self.file_size = file_size
        self.modified_time = modified_time
        self.task_name = task_name
        self.last_backup_time = last_backup_time
        self.version = version


class FingerprintDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fingerprints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                task_name TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                modified_time REAL NOT NULL,
                last_backup_time REAL,
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(file_path, task_name)
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_task_name ON fingerprints(task_name)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_file_path ON fingerprints(file_path)
        ''')

        conn.commit()
        conn.close()
        logger.info(f"指纹数据库已初始化: {self.db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    @staticmethod
    def calculate_file_hash(file_path: str, chunk_size: int = 8192) -> Optional[str]:
        try:
            if not os.path.exists(file_path) or not os.path.isfile(file_path):
                return None

            sha256_hash = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(chunk_size), b''):
                    sha256_hash.update(chunk)
            return sha256_hash.hexdigest()
        except PermissionError:
            logger.warning(f"无法读取文件（权限不足）: {file_path}")
            return None
        except OSError as e:
            logger.warning(f"计算文件哈希失败 {file_path}: {e}")
            return None

    def get_fingerprint(self, file_path: str, task_name: str) -> Optional[FileFingerprint]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT file_path, file_hash, file_size, modified_time, task_name,
                   last_backup_time, version
            FROM fingerprints
            WHERE file_path = ? AND task_name = ?
        ''', (file_path, task_name))

        row = cursor.fetchone()
        conn.close()

        if row:
            return FileFingerprint(
                file_path=row[0],
                file_hash=row[1],
                file_size=row[2],
                modified_time=row[3],
                task_name=row[4],
                last_backup_time=row[5],
                version=row[6]
            )
        return None

    def file_changed(self, file_path: str, task_name: str) -> Tuple[bool, Optional[FileFingerprint], Optional[str]]:
        if not os.path.exists(file_path):
            return False, None, None

        try:
            current_mtime = os.path.getmtime(file_path)
            current_size = os.path.getsize(file_path)
        except OSError as e:
            logger.warning(f"获取文件属性失败 {file_path}: {e}")
            return False, None, None

        stored = self.get_fingerprint(file_path, task_name)

        if stored is None:
            new_hash = self.calculate_file_hash(file_path)
            return True, None, new_hash

        if abs(stored.modified_time - current_mtime) > 0.001 or stored.file_size != current_size:
            new_hash = self.calculate_file_hash(file_path)
            if new_hash and new_hash != stored.file_hash:
                return True, stored, new_hash

        return False, stored, stored.file_hash

    def update_fingerprint(
        self,
        file_path: str,
        task_name: str,
        file_hash: str,
        file_size: int,
        modified_time: float,
        increment_version: bool = False
    ) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('''
                SELECT version FROM fingerprints
                WHERE file_path = ? AND task_name = ?
            ''', (file_path, task_name))

            row = cursor.fetchone()
            current_version = row[0] if row else 0
            new_version = current_version + 1 if increment_version else current_version

            now = datetime.now().timestamp()

            if row:
                cursor.execute('''
                    UPDATE fingerprints
                    SET file_hash = ?, file_size = ?, modified_time = ?,
                        last_backup_time = ?, version = ?, updated_at = ?
                    WHERE file_path = ? AND task_name = ?
                ''', (
                    file_hash, file_size, modified_time,
                    now, new_version, now,
                    file_path, task_name
                ))
            else:
                cursor.execute('''
                    INSERT INTO fingerprints
                    (file_path, task_name, file_hash, file_size, modified_time,
                     last_backup_time, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_path, task_name, file_hash, file_size, modified_time,
                    now, 1, now, now
                ))

            conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"更新指纹数据库失败 {file_path}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def batch_update_fingerprints(self, updates: List[Dict]) -> int:
        success_count = 0
        for update in updates:
            if self.update_fingerprint(
                file_path=update['file_path'],
                task_name=update['task_name'],
                file_hash=update['file_hash'],
                file_size=update['file_size'],
                modified_time=update['modified_time'],
                increment_version=update.get('increment_version', False)
            ):
                success_count += 1
        return success_count

    def get_task_files(self, task_name: str) -> List[FileFingerprint]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT file_path, file_hash, file_size, modified_time, task_name,
                   last_backup_time, version
            FROM fingerprints
            WHERE task_name = ?
            ORDER BY file_path
        ''', (task_name,))

        rows = cursor.fetchall()
        conn.close()

        return [
            FileFingerprint(
                file_path=row[0],
                file_hash=row[1],
                file_size=row[2],
                modified_time=row[3],
                task_name=row[4],
                last_backup_time=row[5],
                version=row[6]
            ) for row in rows
        ]

    def get_all_tasks(self) -> List[str]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT DISTINCT task_name FROM fingerprints ORDER BY task_name
        ''')

        rows = cursor.fetchall()
        conn.close()

        return [row[0] for row in rows]

    def delete_fingerprint(self, file_path: str, task_name: str) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('''
                DELETE FROM fingerprints
                WHERE file_path = ? AND task_name = ?
            ''', (file_path, task_name))

            conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"删除指纹失败 {file_path}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def backup_database(self, backup_dir: Optional[str] = None) -> Optional[str]:
        if backup_dir is None:
            backup_dir = os.path.join(os.path.dirname(self.db_path), 'backups')

        os.makedirs(backup_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        db_filename = os.path.basename(self.db_path)
        backup_path = os.path.join(backup_dir, f"{db_filename}_{timestamp}.bak")

        try:
            shutil.copy2(self.db_path, backup_path)
            logger.info(f"指纹数据库已备份到: {backup_path}")

            self._cleanup_old_backups(backup_dir, db_filename)

            return backup_path
        except IOError as e:
            logger.error(f"备份指纹数据库失败: {e}")
            return None

    @staticmethod
    def _cleanup_old_backups(backup_dir: str, db_filename: str, keep_count: int = 5):
        try:
            backups = [
                f for f in os.listdir(backup_dir)
                if f.startswith(db_filename) and f.endswith('.bak')
            ]
            backups.sort(reverse=True)

            for old_backup in backups[keep_count:]:
                old_path = os.path.join(backup_dir, old_backup)
                os.remove(old_path)
                logger.debug(f"清理旧的数据库备份: {old_path}")
        except OSError as e:
            logger.warning(f"清理旧备份失败: {e}")

    def get_statistics(self, task_name: Optional[str] = None) -> Dict:
        conn = self._get_connection()
        cursor = conn.cursor()

        stats = {}

        if task_name:
            cursor.execute('''
                SELECT COUNT(*), COALESCE(SUM(file_size), 0),
                       COALESCE(MAX(version), 0), COALESCE(AVG(version), 0)
                FROM fingerprints WHERE task_name = ?
            ''', (task_name,))
            row = cursor.fetchone()
            stats[task_name] = {
                'file_count': row[0],
                'total_size': row[1],
                'max_version': row[2],
                'avg_version': row[3]
            }
        else:
            cursor.execute('''
                SELECT task_name, COUNT(*), COALESCE(SUM(file_size), 0),
                       COALESCE(MAX(version), 0), COALESCE(AVG(version), 0)
                FROM fingerprints
                GROUP BY task_name
                ORDER BY task_name
            ''')
            rows = cursor.fetchall()
            for row in rows:
                stats[row[0]] = {
                    'file_count': row[1],
                    'total_size': row[2],
                    'max_version': row[3],
                    'avg_version': row[4]
                }

        conn.close()
        return stats
