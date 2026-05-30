package repository

import (
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/migrator"
)

// modernMigrator overrides CreateTable to use inline default values,
// avoiding the "DEFAULT ?" syntax that SQLite rejects in DDL statements.
type modernMigrator struct {
	migrator.Migrator
}

func (m modernMigrator) RunWithoutForeignKey(fc func() error) error {
	return fc()
}

func (m modernMigrator) CreateTable(values ...interface{}) error {
	for _, value := range values {
		if err := m.createTableInline(value); err != nil {
			return err
		}
	}
	return nil
}

func (m modernMigrator) createTableInline(value interface{}) error {
	stmt := &gorm.Statement{DB: m.DB}
	if m.DB.Statement != nil {
		stmt.Table = m.DB.Statement.Table
	}
	if err := stmt.Parse(value); err != nil {
		return err
	}

	var tableName string
	if stmt.Schema != nil {
		tableName = stmt.Schema.Table
	}
	// If still empty, try to derive from the model type name
	if tableName == "" {
		if v, ok := value.(interface{ TableName() string }); ok {
			tableName = v.TableName()
		}
	}

	var sql strings.Builder
	sql.WriteString("CREATE TABLE IF NOT EXISTS ")
	sql.WriteString(tableName)
	sql.WriteString(" (")

	var columns []string
	for _, dbName := range stmt.Schema.DBNames {
		field := stmt.Schema.FieldsByDBName[dbName]
		colDef := field.DBName + " " + m.Dialector.DataTypeOf(field)

		// Handle default values inline to avoid "DEFAULT ?" placeholder in DDL
		if field.HasDefaultValue {
			var dv string
			if field.DefaultValue != "" && field.DefaultValue != "(-)" {
				dv = field.DefaultValue
			} else if field.DefaultValueInterface != nil {
				dv = inlineDefaultValue(field.DefaultValueInterface)
			}
			if dv != "" {
				colDef += " DEFAULT " + dv
			}
		}

		columns = append(columns, colDef)
	}

	// Add primary key constraint only for non-autoincrement primary keys
	var hasAutoincrementPK bool
	for _, field := range stmt.Schema.Fields {
		if field.PrimaryKey && field.AutoIncrement {
			hasAutoincrementPK = true
			break
		}
	}
	if !hasAutoincrementPK {
		for _, field := range stmt.Schema.Fields {
			if field.PrimaryKey {
				columns = append(columns, "PRIMARY KEY ("+field.DBName+")")
				break
			}
		}
	}

	sql.WriteString(strings.Join(columns, ", "))
	sql.WriteString(")")

	return m.DB.Exec(sql.String()).Error
}

func inlineDefaultValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return "'" + strings.ReplaceAll(val, "'", "''") + "'"
	case bool:
		if val {
			return "1"
		}
		return "0"
	case int:
		return strconv.Itoa(val)
	case int8:
		return strconv.Itoa(int(val))
	case int16:
		return strconv.Itoa(int(val))
	case int32:
		return strconv.Itoa(int(val))
	case int64:
		return strconv.FormatInt(val, 10)
	case uint:
		return strconv.FormatUint(uint64(val), 10)
	case uint8:
		return strconv.FormatUint(uint64(val), 10)
	case uint16:
		return strconv.FormatUint(uint64(val), 10)
	case uint32:
		return strconv.FormatUint(uint64(val), 10)
	case uint64:
		return strconv.FormatUint(val, 10)
	default:
		return fmt.Sprintf("%v", val)
	}
}