package repository

import (
	"context"
	"database/sql"
	"strconv"

	"snippet-manager/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/callbacks"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/migrator"
	"gorm.io/gorm/schema"

	_ "modernc.org/sqlite"
)

type Database struct {
	DB *gorm.DB
}

// modernDialector is a minimal GORM dialector using modernc.org/sqlite ("sqlite" driver name).
type modernDialector struct {
	DSN string
}

func (d modernDialector) Name() string                          { return "sqlite" }
func (d modernDialector) Initialize(db *gorm.DB) error {
	conn, err := sql.Open("sqlite", d.DSN)
	if err != nil {
		return err
	}
	db.ConnPool = conn
	if compareVer(sqliteVersion(conn), "3.35.0") >= 0 {
		callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{
			CreateClauses:        []string{"INSERT", "VALUES", "ON CONFLICT", "RETURNING"},
			UpdateClauses:        []string{"UPDATE", "SET", "FROM", "WHERE", "RETURNING"},
			DeleteClauses:        []string{"DELETE", "FROM", "WHERE", "RETURNING"},
			LastInsertIDReversed: true,
		})
	} else {
		callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{
			LastInsertIDReversed: true,
		})
	}
	for k, v := range d.ClauseBuilders() {
		db.ClauseBuilders[k] = v
	}
	return nil
}
func (d modernDialector) ClauseBuilders() map[string]clause.ClauseBuilder {
	return map[string]clause.ClauseBuilder{
		"LIMIT": func(c clause.Clause, builder clause.Builder) {
			if limit, ok := c.Expression.(clause.Limit); ok {
				var lmt = -1
				if limit.Limit != nil && *limit.Limit >= 0 {
					lmt = *limit.Limit
				}
				if lmt >= 0 || limit.Offset > 0 {
					builder.WriteString("LIMIT ")
					builder.WriteString(strconv.Itoa(lmt))
				}
				if limit.Offset > 0 {
					builder.WriteString(" OFFSET ")
					builder.WriteString(strconv.Itoa(limit.Offset))
				}
			}
		},
		"FOR": func(c clause.Clause, builder clause.Builder) {
			if _, ok := c.Expression.(clause.Locking); ok {
				return
			}
			c.Build(builder)
		},
	}
}
func (d modernDialector) DefaultValueOf(field *schema.Field) clause.Expression {
	return clause.Expr{}
}
func (d modernDialector) Migrator(db *gorm.DB) gorm.Migrator {
	return modernMigrator{migrator.Migrator{Config: migrator.Config{DB: db, Dialector: d, CreateIndexAfterCreateTable: true}}}
}
func (d modernDialector) BindVarTo(writer clause.Writer, stmt *gorm.Statement, v interface{}) { writer.WriteByte('?') }
func (d modernDialector) QuoteTo(writer clause.Writer, str string) {
	var underQuoted, selfQuoted bool
	var continuousBacktick int8
	var shiftDelimiter int8
	for _, v := range []byte(str) {
		switch v {
		case '`':
			continuousBacktick++
			if continuousBacktick == 2 {
				writer.WriteString("``")
				continuousBacktick = 0
			}
		case '.':
			if continuousBacktick > 0 || !selfQuoted {
				shiftDelimiter = 0
				underQuoted = false
				continuousBacktick = 0
				writer.WriteByte('`')
			}
			writer.WriteByte(v)
			continue
		default:
			if shiftDelimiter-continuousBacktick <= 0 && !underQuoted {
				writer.WriteByte('`')
				underQuoted = true
				if selfQuoted = continuousBacktick > 0; selfQuoted {
					continuousBacktick -= 1
				}
			}
			for ; continuousBacktick > 0; continuousBacktick-- {
				writer.WriteString("``")
			}
			writer.WriteByte(v)
		}
		shiftDelimiter++
	}
	if continuousBacktick > 0 && !selfQuoted {
		writer.WriteString("``")
	}
	writer.WriteByte('`')
}
func (d modernDialector) Explain(sql string, vars ...interface{}) string { return sql }
func (d modernDialector) DataTypeOf(field *schema.Field) string {
	switch field.DataType {
	case schema.Bool:
		return "numeric"
	case schema.Int, schema.Uint:
		if field.AutoIncrement {
			return "integer PRIMARY KEY AUTOINCREMENT"
		}
		return "integer"
	case schema.Float:
		return "real"
	case schema.String:
		return "text"
	case schema.Time:
		if val, ok := field.TagSettings["TYPE"]; ok {
			return val
		}
		return "datetime"
	case schema.Bytes:
		return "blob"
	}
	return string(field.DataType)
}
func (d modernDialector) SavePoint(tx *gorm.DB, name string) error { return tx.Exec("SAVEPOINT " + name).Error }
func (d modernDialector) RollbackTo(tx *gorm.DB, name string) error { return tx.Exec("ROLLBACK TO SAVEPOINT " + name).Error }

func NewDatabase(dbPath string) (*Database, error) {
	db, err := gorm.Open(modernDialector{DSN: dbPath}, &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	err = db.AutoMigrate(
		&model.User{},
		&model.Team{},
		&model.TeamMember{},
		&model.Snippet{},
		&model.Tag{},
		&model.SnippetTag{},
		&model.SnippetVersion{},
		&model.Comment{},
		&model.Favorite{},
		&model.SnippetReference{},
	)
	if err != nil {
		return nil, err
	}

	return &Database{DB: db}, nil
}

func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func sqliteVersion(conn *sql.DB) string {
	var v string
	conn.QueryRowContext(context.Background(), "select sqlite_version()").Scan(&v)
	return v
}

func compareVer(v1, v2 string) int {
	i, j := 0, 0
	for i < len(v1) || j < len(v2) {
		x := 0
		for ; i < len(v1) && v1[i] != '.'; i++ {
			x = x*10 + int(v1[i]-'0')
		}
		if i < len(v1) {
			i++
		}
		y := 0
		for ; j < len(v2) && v2[j] != '.'; j++ {
			y = y*10 + int(v2[j]-'0')
		}
		if j < len(v2) {
			j++
		}
		if x > y {
			return 1
		}
		if x < y {
			return -1
		}
	}
	return 0
}
