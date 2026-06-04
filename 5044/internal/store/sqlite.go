package store

import (
	"database/sql"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/callbacks"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/migrator"
	"gorm.io/gorm/schema"

	_ "modernc.org/sqlite"
)

type SQLite struct {
	DSN  string
	Conn *sql.DB
}

func Open(dsn string) gorm.Dialector {
	return &SQLite{DSN: dsn}
}

func (sqlite *SQLite) Name() string {
	return "sqlite"
}

func (sqlite *SQLite) Initialize(db *gorm.DB) (err error) {
	callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{
		CreateClauses: []string{"INSERT", "VALUES", "ON CONFLICT"},
		QueryClauses:  []string{"SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT"},
		UpdateClauses: []string{"UPDATE", "SET", "WHERE"},
		DeleteClauses: []string{"DELETE", "FROM", "WHERE"},
	})

	if sqlite.Conn != nil {
		db.ConnPool = sqlite.Conn
	} else {
		db.ConnPool, err = sql.Open("sqlite", sqlite.DSN)
		if err != nil {
			return err
		}
	}

	db.ClauseBuilders["ON CONFLICT"] = func(c clause.Clause, builder clause.Builder) {
		if onConflict, ok := c.Expression.(clause.OnConflict); ok {
			builder.WriteString("ON CONFLICT")
			if len(onConflict.Columns) > 0 {
				builder.WriteByte('(')
				for idx, column := range onConflict.Columns {
					if idx > 0 {
						builder.WriteByte(',')
					}
					builder.WriteQuoted(column)
				}
				builder.WriteByte(')')
			}
			if onConflict.DoNothing {
				builder.WriteString(" DO NOTHING")
			} else {
				builder.WriteString(" DO UPDATE SET ")
				clause.Set(onConflict.DoUpdates).Build(builder)
			}
		}
	}

	return nil
}

func (sqlite *SQLite) Migrator(db *gorm.DB) gorm.Migrator {
	return &SQLiteMigrator{
		Migrator: migrator.Migrator{
			Config: migrator.Config{
				DB:        db,
				Dialector: sqlite,
			},
		},
	}
}

func (sqlite *SQLite) DataTypeOf(field *schema.Field) string {
	switch field.DataType {
	case schema.Bool:
		return "INTEGER"
	case schema.Int, schema.Uint:
		return "INTEGER"
	case schema.Float:
		return "REAL"
	case schema.String:
		return "TEXT"
	case schema.Time:
		return "DATETIME"
	case schema.Bytes:
		return "BLOB"
	}
	return string(field.DataType)
}

func (sqlite *SQLite) BindVarTo(writer clause.Writer, stmt *gorm.Statement, v interface{}) {
	writer.WriteByte('?')
}

func (sqlite *SQLite) QuoteTo(writer clause.Writer, str string) {
	writer.WriteByte('`')
	writer.WriteString(str)
	writer.WriteByte('`')
}

func (sqlite *SQLite) Explain(sql string, vars ...interface{}) string {
	return logger.ExplainSQL(sql, nil, `"`, vars...)
}

func (sqlite *SQLite) DefaultValueOf(field *schema.Field) clause.Expression {
	return clause.Expr{SQL: "NULL"}
}

type SQLiteMigrator struct {
	migrator.Migrator
}

func (m *SQLiteMigrator) HasTable(value interface{}) bool {
	var count int64
	m.Migrator.RunWithValue(value, func(stmt *gorm.Statement) error {
		return m.DB.Raw("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?", stmt.Table).Row().Scan(&count)
	})
	return count > 0
}

func (m *SQLiteMigrator) AutoMigrate(values ...interface{}) error {
	for _, value := range values {
		if err := m.Migrator.AutoMigrate(value); err != nil {
			return err
		}
	}
	return nil
}

func (m *SQLiteMigrator) DropTable(values ...interface{}) error {
	for _, value := range values {
		err := m.RunWithValue(value, func(stmt *gorm.Statement) error {
			return m.DB.Exec(fmt.Sprintf("DROP TABLE IF EXISTS `%s`", stmt.Table)).Error
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *SQLiteMigrator) HasColumn(value interface{}, field string) bool {
	var count int64
	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		rows, err := m.DB.Raw(fmt.Sprintf("PRAGMA table_info(`%s`)", stmt.Table)).Rows()
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var (
				cid     int
				name    string
				ctype   string
				notnull int
				dflt    *string
				pk      int
			)
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err == nil && name == field {
				count = 1
				break
			}
		}
		return nil
	})
	return count > 0
}

func (m *SQLiteMigrator) HasIndex(value interface{}, name string) bool {
	var count int64
	m.RunWithValue(value, func(stmt *gorm.Statement) error {
		return m.DB.Raw("SELECT count(*) FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?", name, stmt.Table).Row().Scan(&count)
	})
	return count > 0
}
