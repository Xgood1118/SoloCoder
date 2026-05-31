import os
import shutil
import glob
from datetime import datetime, timedelta

from budget_tracker.config import BACKUP_DIR, AUTO_BACKUP_INTERVAL_HOURS
from budget_tracker.database import Database


class BackupService:
    def __init__(self, db: Database = None):
        self.db = db
        self.db_path = db.db_path if db else None
        self.backup_dir = BACKUP_DIR
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_backup(self, db_path=None):
        source_path = db_path or self.db_path
        if source_path is None:
            raise ValueError("No database path provided")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        db_filename = os.path.basename(source_path)
        name, ext = os.path.splitext(db_filename)
        backup_filename = f"{name}_{timestamp}{ext}"
        backup_path = os.path.join(self.backup_dir, backup_filename)

        shutil.copy2(source_path, backup_path)
        return backup_path

    def list_backups(self):
        backups = []
        pattern = os.path.join(self.backup_dir, "*.db")
        backup_files = glob.glob(pattern)
        backup_files.sort(key=os.path.getmtime, reverse=True)

        for file_path in backup_files:
            stat = os.stat(file_path)
            backups.append({
                "filename": os.path.basename(file_path),
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size,
            })

        return backups

    def restore_backup(self, backup_file):
        backup_path = os.path.join(self.backup_dir, backup_file)
        if not os.path.exists(backup_path):
            return False

        target_path = self.db_path
        if target_path is None:
            raise ValueError("No database path configured")

        shutil.copy2(backup_path, target_path)
        return True

    def auto_backup(self, force=False):
        if force:
            return self.create_backup()

        backups = self.list_backups()
        if not backups:
            return self.create_backup()

        last_backup = backups[0]
        last_created = datetime.fromisoformat(last_backup["created"])
        now = datetime.now()
        interval = timedelta(hours=AUTO_BACKUP_INTERVAL_HOURS)

        if now - last_created > interval:
            return self.create_backup()

        return None

    def delete_old_backups(self, keep_days=30):
        cutoff = datetime.now() - timedelta(days=keep_days)
        deleted = 0

        pattern = os.path.join(self.backup_dir, "*.db")
        backup_files = glob.glob(pattern)

        for file_path in backup_files:
            stat = os.stat(file_path)
            created = datetime.fromtimestamp(stat.st_mtime)
            if created < cutoff:
                os.remove(file_path)
                deleted += 1

        return deleted
