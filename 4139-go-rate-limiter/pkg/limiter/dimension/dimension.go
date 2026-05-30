package dimension

import (
	"net/http"
	"path/filepath"
	"strings"
)

type DimensionType string

const (
	DimensionIP       DimensionType = "ip"
	DimensionUserID   DimensionType = "user_id"
	DimensionPath     DimensionType = "path"
	DimensionService  DimensionType = "service"
	DimensionRegion   DimensionType = "region"
	DimensionHeader   DimensionType = "header"
	DimensionQuery    DimensionType = "query"
	DimensionCombined DimensionType = "combined"
)

type Dimension struct {
	Type      DimensionType
	Name      string
	Value     string
	Pattern   string
	Extractor ExtractorFunc
}

type RequestContext struct {
	Request *http.Request
	Path    string
	UserID  string
	IP      string
	Service string
	Region  string
	Headers map[string]string
	Query   map[string]string
	Extra   map[string]interface{}
}

type ExtractorFunc func(ctx *RequestContext) (string, error)

type Extractor interface {
	Extract(ctx *RequestContext) (string, error)
	GetType() DimensionType
	GetName() string
}

type BaseExtractor struct {
	dimType DimensionType
	name    string
}

func (e *BaseExtractor) GetType() DimensionType {
	return e.dimType
}

func (e *BaseExtractor) GetName() string {
	return e.name
}

type IPExtractor struct {
	BaseExtractor
}

func NewIPExtractor() *IPExtractor {
	return &IPExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionIP,
			name:    "ip",
		},
	}
}

func (e *IPExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.IP != "" {
		return ctx.IP, nil
	}
	if ctx.Request != nil {
		return GetClientIP(ctx.Request), nil
	}
	return "", nil
}

type UserIDExtractor struct {
	BaseExtractor
	HeaderKey string
}

func NewUserIDExtractor(headerKey string) *UserIDExtractor {
	if headerKey == "" {
		headerKey = "X-User-ID"
	}
	return &UserIDExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionUserID,
			name:    "user_id",
		},
		HeaderKey: headerKey,
	}
}

func (e *UserIDExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.UserID != "" {
		return ctx.UserID, nil
	}
	if ctx.Request != nil {
		userID := ctx.Request.Header.Get(e.HeaderKey)
		if userID != "" {
			return userID, nil
		}
	}
	return "", nil
}

type PathExtractor struct {
	BaseExtractor
	Pattern string
}

func NewPathExtractor(pattern string) *PathExtractor {
	return &PathExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionPath,
			name:    "path",
		},
		Pattern: pattern,
	}
}

func (e *PathExtractor) Extract(ctx *RequestContext) (string, error) {
	path := ctx.Path
	if path == "" && ctx.Request != nil {
		path = ctx.Request.URL.Path
	}

	if e.Pattern == "" {
		return path, nil
	}

	if MatchPathPattern(e.Pattern, path) {
		return e.Pattern, nil
	}

	return "", nil
}

type ServiceExtractor struct {
	BaseExtractor
	HeaderKey string
}

func NewServiceExtractor(headerKey string) *ServiceExtractor {
	if headerKey == "" {
		headerKey = "X-Service-Name"
	}
	return &ServiceExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionService,
			name:    "service",
		},
		HeaderKey: headerKey,
	}
}

func (e *ServiceExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.Service != "" {
		return ctx.Service, nil
	}
	if ctx.Request != nil {
		service := ctx.Request.Header.Get(e.HeaderKey)
		if service != "" {
			return service, nil
		}
	}
	return "", nil
}

type RegionExtractor struct {
	BaseExtractor
	HeaderKey string
}

func NewRegionExtractor(headerKey string) *RegionExtractor {
	if headerKey == "" {
		headerKey = "X-Region"
	}
	return &RegionExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionRegion,
			name:    "region",
		},
		HeaderKey: headerKey,
	}
}

func (e *RegionExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.Region != "" {
		return ctx.Region, nil
	}
	if ctx.Request != nil {
		region := ctx.Request.Header.Get(e.HeaderKey)
		if region != "" {
			return region, nil
		}
	}
	return "", nil
}

type HeaderExtractor struct {
	BaseExtractor
	HeaderKey string
}

func NewHeaderExtractor(headerKey string) *HeaderExtractor {
	return &HeaderExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionHeader,
			name:    "header:" + headerKey,
		},
		HeaderKey: headerKey,
	}
}

func (e *HeaderExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.Headers != nil {
		if val, ok := ctx.Headers[e.HeaderKey]; ok {
			return val, nil
		}
	}
	if ctx.Request != nil {
		return ctx.Request.Header.Get(e.HeaderKey), nil
	}
	return "", nil
}

type QueryExtractor struct {
	BaseExtractor
	ParamName string
}

func NewQueryExtractor(paramName string) *QueryExtractor {
	return &QueryExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionQuery,
			name:    "query:" + paramName,
		},
		ParamName: paramName,
	}
}

func (e *QueryExtractor) Extract(ctx *RequestContext) (string, error) {
	if ctx.Query != nil {
		if val, ok := ctx.Query[e.ParamName]; ok {
			return val, nil
		}
	}
	if ctx.Request != nil {
		return ctx.Request.URL.Query().Get(e.ParamName), nil
	}
	return "", nil
}

type CombinedExtractor struct {
	BaseExtractor
	Extractors []Extractor
	Separator  string
}

func NewCombinedExtractor(extractors []Extractor, separator string) *CombinedExtractor {
	if separator == "" {
		separator = ":"
	}
	return &CombinedExtractor{
		BaseExtractor: BaseExtractor{
			dimType: DimensionCombined,
			name:    "combined",
		},
		Extractors: extractors,
		Separator:  separator,
	}
}

func (e *CombinedExtractor) Extract(ctx *RequestContext) (string, error) {
	var parts []string
	for _, ext := range e.Extractors {
		val, err := ext.Extract(ctx)
		if err != nil {
			return "", err
		}
		if val == "" {
			return "", nil
		}
		parts = append(parts, val)
	}
	return strings.Join(parts, e.Separator), nil
}

func MatchPathPattern(pattern, path string) bool {
	if pattern == path {
		return true
	}

	if pattern == "" {
		return true
	}

	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		if strings.HasPrefix(path, prefix) {
			if len(path) == len(prefix) || path[len(prefix)] == '/' {
				return true
			}
		}
	}

	if strings.Contains(pattern, "*") || strings.Contains(pattern, "?") {
		matched, err := filepath.Match(pattern, path)
		if err == nil && matched {
			return true
		}
	}

	return false
}

func GetClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}

	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		ips := strings.Split(ip, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	ip = r.Header.Get("X-Real-IP")
	if ip != "" {
		return ip
	}

	ip = r.Header.Get("X-Client-IP")
	if ip != "" {
		return ip
	}

	remoteAddr := r.RemoteAddr
	if idx := strings.LastIndex(remoteAddr, ":"); idx != -1 {
		return remoteAddr[:idx]
	}

	return remoteAddr
}

func NewExtractor(dim Dimension) (Extractor, error) {
	switch dim.Type {
	case DimensionIP:
		return NewIPExtractor(), nil
	case DimensionUserID:
		return NewUserIDExtractor(dim.Name), nil
	case DimensionPath:
		return NewPathExtractor(dim.Pattern), nil
	case DimensionService:
		return NewServiceExtractor(dim.Name), nil
	case DimensionRegion:
		return NewRegionExtractor(dim.Name), nil
	case DimensionHeader:
		return NewHeaderExtractor(dim.Name), nil
	case DimensionQuery:
		return NewQueryExtractor(dim.Name), nil
	default:
		return nil, nil
	}
}

func BuildKey(extractors []Extractor, ctx *RequestContext) (string, error) {
	var parts []string
	for _, ext := range extractors {
		val, err := ext.Extract(ctx)
		if err != nil {
			return "", err
		}
		if val == "" {
			return "", nil
		}
		parts = append(parts, ext.GetName()+"="+val)
	}
	return strings.Join(parts, "|"), nil
}
