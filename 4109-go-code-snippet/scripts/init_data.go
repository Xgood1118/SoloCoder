package main

import (
	"log"

	"snippet-manager/internal/model"
	"snippet-manager/internal/repository"

	"gorm.io/gorm"
)

func main() {
	db, err := repository.NewDatabase("snippets.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initSampleData(db.DB); err != nil {
		log.Fatalf("Failed to initialize sample data: %v", err)
	}

	log.Println("Sample data initialized successfully!")
}

func initSampleData(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		admin := &model.User{
			Username: "admin",
			Email:    "admin@example.com",
			Password: "admin123",
			Role:     model.RoleAdmin,
		}
		if err := tx.FirstOrCreate(admin, model.User{Username: "admin"}).Error; err != nil {
			return err
		}

		member := &model.User{
			Username: "member1",
			Email:    "member1@example.com",
			Password: "member123",
			Role:     model.RoleMember,
		}
		if err := tx.FirstOrCreate(member, model.User{Username: "member1"}).Error; err != nil {
			return err
		}

		team := &model.Team{
			Name:        "开发团队",
			Description: "主要负责产品开发",
		}
		if err := tx.FirstOrCreate(team, model.Team{Name: "开发团队"}).Error; err != nil {
			return err
		}

		if err := tx.Model(team).Association("Members").Append([]*model.User{admin, member}); err != nil {
			return err
		}

		snippets := []*model.Snippet{
			{
				TeamID:      team.ID,
				CreatorID:   admin.ID,
				Title:       "HTTP GET 请求工具函数",
				Language:    "Go",
				Code:        httpGetCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
			{
				TeamID:      team.ID,
				CreatorID:   admin.ID,
				Title:       "MySQL 数据库连接池",
				Language:    "Go",
				Code:        mysqlPoolCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
			{
				TeamID:      team.ID,
				CreatorID:   member.ID,
				Title:       "Python 日志配置",
				Language:    "Python",
				Code:        pythonLogCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    false,
			},
			{
				TeamID:      team.ID,
				CreatorID:   member.ID,
				Title:       "JavaScript 防抖函数",
				Language:    "JavaScript",
				Code:        debounceCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
			{
				TeamID:      team.ID,
				CreatorID:   admin.ID,
				Title:       "Rust 并发安全计数器",
				Language:    "Rust",
				Code:        rustCounterCode,
				Visibility:  model.VisibilityPrivate,
				LibraryType: model.LibraryPrivate,
				IsPublic:    false,
			},
			{
				TeamID:      team.ID,
				CreatorID:   admin.ID,
				Title:       "Shell 脚本批量重命名",
				Language:    "Shell",
				Code:        shellRenameCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
			{
				TeamID:      team.ID,
				CreatorID:   member.ID,
				Title:       "SQL 查询优化示例",
				Language:    "SQL",
				Code:        sqlOptimizeCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
			{
				TeamID:      team.ID,
				CreatorID:   admin.ID,
				Title:       "Java 单例模式实现",
				Language:    "Java",
				Code:        javaSingletonCode,
				Visibility:  model.VisibilityPublic,
				LibraryType: model.LibraryPublic,
				IsPublic:    true,
			},
		}

		for _, snip := range snippets {
			var count int64
			tx.Model(&model.Snippet{}).Where("team_id = ? AND title = ?", team.ID, snip.Title).Count(&count)
			if count > 0 {
				continue
			}

			if err := tx.Create(snip).Error; err != nil {
				return err
			}

			version := &model.SnippetVersion{
				SnippetID:  snip.ID,
				Version:    1,
				Code:       snip.Code,
				ModifierID: snip.CreatorID,
			}
			if err := tx.Create(version).Error; err != nil {
				return err
			}
		}

		tags := []string{"工具函数", "网络", "数据库", "并发", "前端", "脚本", "性能优化", "设计模式"}
		for _, tagName := range tags {
			tag := &model.Tag{Name: tagName}
			if err := tx.FirstOrCreate(tag, model.Tag{Name: tagName}).Error; err != nil {
				return err
			}
		}

		var allSnippets []*model.Snippet
		tx.Where("team_id = ?", team.ID).Find(&allSnippets)
		var allTags []*model.Tag
		tx.Find(&allTags)

		for i, snip := range allSnippets {
			tagIndex := i % len(allTags)
			if err := tx.Model(snip).Association("Tags").Append(allTags[tagIndex]); err != nil {
				return err
			}
			if tagIndex+1 < len(allTags) {
				if err := tx.Model(snip).Association("Tags").Append(allTags[tagIndex+1]); err != nil {
					return err
				}
			}
		}

		comments := []struct {
			snippetIndex int
			authorID     uint
			content      string
		}{
			{0, member.ID, "这个函数很实用，已经在项目中使用了！"},
			{1, member.ID, "连接池配置参数可以根据实际情况调整"},
			{2, admin.ID, "日志格式很规范"},
			{3, admin.ID, "防抖函数写得不错"},
		}

		for _, c := range comments {
			if c.snippetIndex < len(allSnippets) {
				comment := &model.Comment{
					SnippetID: allSnippets[c.snippetIndex].ID,
					AuthorID:  c.authorID,
					Content:   c.content,
				}
				if err := tx.Create(comment).Error; err != nil {
					return err
				}
			}
		}

		favorites := []struct {
			userID    uint
			snippetIdx int
		}{
			{member.ID, 0},
			{member.ID, 3},
			{admin.ID, 2},
		}

		for _, f := range favorites {
			if f.snippetIdx < len(allSnippets) {
				favorite := &model.Favorite{
					UserID:    f.userID,
					SnippetID: allSnippets[f.snippetIdx].ID,
				}
				tx.FirstOrCreate(favorite, model.Favorite{UserID: f.userID, SnippetID: allSnippets[f.snippetIdx].ID})
			}
		}

		log.Printf("Created %d users, %d team, %d snippets, %d tags, %d comments",
			2, 1, len(snippets), len(tags), len(comments))

		return nil
	})
}

const (
	httpGetCode = `package httpclient

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (c *Client) Get(path string, result interface{}) error {
	resp, err := c.httpClient.Get(c.baseURL + path)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return &HTTPError{
			StatusCode: resp.StatusCode,
			Message:    string(body),
		}
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

func (c *Client) Post(path string, body, result interface{}) error {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Post(
		c.baseURL+path,
		"application/json",
		bytes.NewBuffer(jsonBody),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return &HTTPError{
			StatusCode: resp.StatusCode,
			Message:    string(respBody),
		}
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

type HTTPError struct {
	StatusCode int
	Message    string
}

func (e *HTTPError) Error() string {
	return e.Message
}`

	mysqlPoolCode = `package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	MaxOpen  int
	MaxIdle  int
}

func NewMySQLPool(cfg Config) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if cfg.MaxOpen > 0 {
		db.SetMaxOpenConns(cfg.MaxOpen)
	} else {
		db.SetMaxOpenConns(100)
	}

	if cfg.MaxIdle > 0 {
		db.SetMaxIdleConns(cfg.MaxIdle)
	} else {
		db.SetMaxIdleConns(10)
	}

	db.SetConnMaxLifetime(1 * time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("MySQL connection pool initialized successfully")
	return db, nil
}

func HealthCheck(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return db.PingContext(ctx)
}`

	pythonLogCode = `import logging
import sys
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path


def setup_logger(
    name: str = "app",
    level: str = "INFO",
    log_dir: str = "logs",
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5,
    console: bool = True,
) -> logging.Logger:
    """
    配置日志记录器

    Args:
        name: 日志名称
        level: 日志级别
        log_dir: 日志目录
        max_bytes: 单个日志文件最大大小
        backup_count: 保留的日志文件数量
        console: 是否输出到控制台

    Returns:
        配置好的日志记录器
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    logger.propagate = False

    if logger.handlers:
        return logger

    Path(log_dir).mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    file_handler = RotatingFileHandler(
        f"{log_dir}/{name}.log",
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    error_handler = RotatingFileHandler(
        f"{log_dir}/{name}_error.log",
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    logger.addHandler(error_handler)

    if console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger


if __name__ == "__main__":
    logger = setup_logger("myapp", level="DEBUG")
    logger.debug("Debug message")
    logger.info("Info message")
    logger.warning("Warning message")
    logger.error("Error message")`

	debounceCode = `/**
 * 防抖函数 - 在事件被触发n秒后再执行回调，如果在这n秒内又被触发，则重新计时
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait = 300, immediate = false) {
  let timeout;
  let result;

  const debounced = function(...args) {
    const context = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    if (immediate) {
      const callNow = !timeout;
      timeout = setTimeout(() => {
        timeout = null;
      }, wait);

      if (callNow) {
        result = func.apply(context, args);
      }
    } else {
      timeout = setTimeout(() => {
        result = func.apply(context, args);
      }, wait);
    }

    return result;
  };

  debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  debounced.flush = function() {
    if (timeout) {
      clearTimeout(timeout);
      result = func.apply(this, arguments);
      timeout = null;
    }
    return result;
  };

  return debounced;
}

/**
 * 节流函数 - 规定在一个单位时间内，只能触发一次函数
 * @param {Function} func - 要节流的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} options - 配置选项
 * @returns {Function} 节流后的函数
 */
function throttle(func, wait = 300, options = {}) {
  let timeout;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  return function(...args) {
    const context = this;
    const now = Date.now();

    if (!previous && !leading) {
      previous = now;
    }

    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = leading ? Date.now() : 0;
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };
}

// 使用示例
const searchInput = document.getElementById('search');
const handleSearch = debounce((e) => {
  console.log('Searching:', e.target.value);
}, 500);

searchInput.addEventListener('input', handleSearch);`

	rustCounterCode = `use std::sync::{Arc, Mutex};
use std::thread;

/// 线程安全的计数器
#[derive(Clone)]
struct Counter {
    count: Arc<Mutex<i64>>,
}

impl Counter {
    fn new() -> Self {
        Counter {
            count: Arc::new(Mutex::new(0)),
        }
    }

    fn increment(&self) -> i64 {
        let mut count = self.count.lock().unwrap();
        *count += 1;
        *count
    }

    fn decrement(&self) -> i64 {
        let mut count = self.count.lock().unwrap();
        *count -= 1;
        *count
    }

    fn get(&self) -> i64 {
        let count = self.count.lock().unwrap();
        *count
    }

    fn reset(&self) -> i64 {
        let mut count = self.count.lock().unwrap();
        *count = 0;
        *count
    }
}

fn main() {
    let counter = Counter::new();
    let mut handles = vec![];

    for i in 0..10 {
        let counter_clone = counter.clone();
        let handle = thread::spawn(move || {
            for _ in 0..1000 {
                counter_clone.increment();
            }
            println!("Thread {} finished", i);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Final count: {}", counter.get());
    assert_eq!(counter.get(), 10000);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_basic() {
        let counter = Counter::new();
        assert_eq!(counter.get(), 0);
        assert_eq!(counter.increment(), 1);
        assert_eq!(counter.increment(), 2);
        assert_eq!(counter.decrement(), 1);
        assert_eq!(counter.reset(), 0);
    }

    #[test]
    fn test_concurrent_access() {
        let counter = Counter::new();
        let mut handles = vec![];

        for _ in 0..100 {
            let c = counter.clone();
            handles.push(thread::spawn(move || {
                for _ in 0..100 {
                    c.increment();
                }
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        assert_eq!(counter.get(), 10000);
    }
}`

	shellRenameCode = `#!/bin/bash

# 批量重命名文件脚本
# 使用方法: ./batch_rename.sh [目录] [前缀] [扩展名]

set -e

DIR="${1:-.}"
PREFIX="${2:-file}"
EXT="${3:-}"

count=1

echo "开始批量重命名文件..."
echo "目录: $DIR"
echo "前缀: $PREFIX"
echo "扩展名: $EXT"
echo ""

cd "$DIR"

for file in *; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        extension="${filename##*.}"

        if [ -n "$EXT" ] && [ "$extension" != "$EXT" ]; then
            continue
        fi

        new_name="${PREFIX}_$(printf "%03d" $count).${extension}"

        if [ "$file" != "$new_name" ]; then
            mv -n "$file" "$new_name"
            echo "重命名: $file -> $new_name"
            count=$((count + 1))
        fi
    fi
done

echo ""
echo "完成! 共重命名 $((count - 1)) 个文件"`

	sqlOptimizeCode = `-- SQL 查询优化示例
-- 索引优化、查询重写、执行计划分析

-- ============================================
-- 1. 索引优化
-- ============================================

-- 为常用查询条件创建复合索引
CREATE INDEX idx_users_status_created ON users(status, created_at);

-- 为排序字段创建索引
CREATE INDEX idx_orders_amount ON orders(amount DESC);

-- 覆盖索引 - 包含查询所需的所有列
CREATE INDEX idx_orders_customer_amount ON orders(customer_id, amount, order_date);

-- 删除未使用的索引
-- DROP INDEX idx_old ON table_name;

-- ============================================
-- 2. 查询重写优化
-- ============================================

-- 避免在 WHERE 子句中使用函数
-- 不好的写法:
SELECT * FROM orders WHERE DATE(order_date) = '2024-01-01';

-- 好的写法:
SELECT * FROM orders WHERE order_date >= '2024-01-01' AND order_date < '2024-01-02';

-- 避免使用 SELECT *
-- 不好的写法:
SELECT * FROM users;

-- 好的写法:
SELECT id, username, email, created_at FROM users WHERE status = 'active';

-- 使用 JOIN 代替子查询
-- 不好的写法:
SELECT * FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE country = 'CN');

-- 好的写法:
SELECT o.*
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id
WHERE c.country = 'CN';

-- ============================================
-- 3. 分页查询优化
-- ============================================

-- 大偏移量分页优化
-- 不好的写法:
SELECT * FROM orders ORDER BY id LIMIT 100000, 20;

-- 好的写法:
SELECT * FROM orders
WHERE id > (SELECT id FROM orders ORDER BY id LIMIT 100000, 1)
ORDER BY id LIMIT 20;

-- ============================================
-- 4. 批量操作优化
-- ============================================

-- 批量插入
INSERT INTO users (username, email) VALUES
('user1', 'user1@example.com'),
('user2', 'user2@example.com'),
('user3', 'user3@example.com');

-- ============================================
-- 5. 执行计划分析
-- ============================================

-- 查看执行计划
EXPLAIN SELECT * FROM orders WHERE customer_id = 123;

-- 查看详细执行计划
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 123;`

	javaSingletonCode = `// 单例模式的几种实现方式

// 1. 饿汉式 - 线程安全，但在类加载时就初始化
public class EagerSingleton {
    private static final EagerSingleton INSTANCE = new EagerSingleton();

    private EagerSingleton() {}

    public static EagerSingleton getInstance() {
        return INSTANCE;
    }
}

// 2. 懒汉式 - 非线程安全
public class LazySingleton {
    private static LazySingleton instance;

    private LazySingleton() {}

    public static LazySingleton getInstance() {
        if (instance == null) {
            instance = new LazySingleton();
        }
        return instance;
    }
}

// 3. 懒汉式 - 线程安全（synchronized）
public class ThreadSafeSingleton {
    private static ThreadSafeSingleton instance;

    private ThreadSafeSingleton() {}

    public static synchronized ThreadSafeSingleton getInstance() {
        if (instance == null) {
            instance = new ThreadSafeSingleton();
        }
        return instance;
    }
}

// 4. 双重检查锁定（DCL）- 推荐使用
public class DoubleCheckedSingleton {
    private static volatile DoubleCheckedSingleton instance;

    private DoubleCheckedSingleton() {}

    public static DoubleCheckedSingleton getInstance() {
        if (instance == null) {
            synchronized (DoubleCheckedSingleton.class) {
                if (instance == null) {
                    instance = new DoubleCheckedSingleton();
                }
            }
        }
        return instance;
    }
}

// 5. 静态内部类 - 推荐使用
public class BillPughSingleton {
    private BillPughSingleton() {}

    private static class SingletonHolder {
        private static final BillPughSingleton INSTANCE = new BillPughSingleton();
    }

    public static BillPughSingleton getInstance() {
        return SingletonHolder.INSTANCE;
    }
}

// 6. 枚举方式 - 最简单且安全
public enum EnumSingleton {
    INSTANCE;

    public void doSomething() {
        System.out.println("Singleton using enum");
    }
}

// 使用示例
public class Main {
    public static void main(String[] args) {
        DoubleCheckedSingleton singleton = DoubleCheckedSingleton.getInstance();
        singleton.doSomething();

        EnumSingleton.INSTANCE.doSomething();
    }
}`
)
