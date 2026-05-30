package dimension

import (
	"net/http"
	"net/url"
	"testing"
)

func TestIPExtractor(t *testing.T) {
	ext := NewIPExtractor()

	ctx := &RequestContext{
		IP: "192.168.1.1",
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "192.168.1.1" {
		t.Errorf("expected 192.168.1.1, got %s", val)
	}

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2")
	ctx2 := &RequestContext{
		Request: req,
	}

	val, err = ext.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "10.0.0.1" {
		t.Errorf("expected 10.0.0.1 from X-Forwarded-For, got %s", val)
	}
}

func TestUserIDExtractor(t *testing.T) {
	ext := NewUserIDExtractor("")

	ctx := &RequestContext{
		UserID: "user123",
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "user123" {
		t.Errorf("expected user123, got %s", val)
	}

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-ID", "user456")
	ctx2 := &RequestContext{
		Request: req,
	}

	val, err = ext.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "user456" {
		t.Errorf("expected user456 from header, got %s", val)
	}
}

func TestPathExtractor(t *testing.T) {
	ext := NewPathExtractor("")

	ctx := &RequestContext{
		Path: "/api/v1/users",
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "/api/v1/users" {
		t.Errorf("expected /api/v1/users, got %s", val)
	}

	ext2 := NewPathExtractor("/api/v1/*")
	ctx2 := &RequestContext{
		Path: "/api/v1/users/123",
	}

	val, err = ext2.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "/api/v1/*" {
		t.Errorf("expected /api/v1/* pattern, got %s", val)
	}

	ctx3 := &RequestContext{
		Path: "/other/path",
	}

	val, err = ext2.Extract(ctx3)
	if err != nil {
		t.Fatal(err)
	}
	if val != "" {
		t.Errorf("expected empty string for non-matching path, got %s", val)
	}
}

func TestMatchPathPattern(t *testing.T) {
	tests := []struct {
		pattern string
		path    string
		want    bool
	}{
		{"/api/v1/users", "/api/v1/users", true},
		{"/api/v1/*", "/api/v1/users", true},
		{"/api/v1/*", "/api/v1/users/123", true},
		{"/api/v1/*", "/api/v2/users", false},
		{"/api/*/users", "/api/v1/users", true},
		{"/api/*/users", "/api/v2/users", true},
		{"/api/?/users", "/api/1/users", true},
		{"/api/?/users", "/api/12/users", false},
		{"", "/any/path", true},
	}

	for _, tt := range tests {
		t.Run(tt.pattern+"_"+tt.path, func(t *testing.T) {
			got := MatchPathPattern(tt.pattern, tt.path)
			if got != tt.want {
				t.Errorf("MatchPathPattern(%s, %s) = %v, want %v", tt.pattern, tt.path, got, tt.want)
			}
		})
	}
}

func TestGetClientIP(t *testing.T) {
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"

	ip := GetClientIP(req)
	if ip != "192.168.1.100" {
		t.Errorf("expected 192.168.1.100, got %s", ip)
	}

	req.Header.Set("X-Real-IP", "10.0.0.1")
	ip = GetClientIP(req)
	if ip != "10.0.0.1" {
		t.Errorf("expected 10.0.0.1 from X-Real-IP, got %s", ip)
	}

	req.Header.Set("X-Forwarded-For", "20.0.0.1, 20.0.0.2")
	ip = GetClientIP(req)
	if ip != "20.0.0.1" {
		t.Errorf("expected 20.0.0.1 from X-Forwarded-For, got %s", ip)
	}
}

func TestCombinedExtractor(t *testing.T) {
	ipExt := NewIPExtractor()
	userExt := NewUserIDExtractor("")

	combined := NewCombinedExtractor([]Extractor{ipExt, userExt}, ":")

	ctx := &RequestContext{
		IP:     "192.168.1.1",
		UserID: "user123",
	}

	val, err := combined.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "192.168.1.1:user123" {
		t.Errorf("expected 192.168.1.1:user123, got %s", val)
	}

	ctx2 := &RequestContext{
		IP: "192.168.1.1",
	}

	val, err = combined.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "" {
		t.Errorf("expected empty string when user_id is missing, got %s", val)
	}
}

func TestHeaderExtractor(t *testing.T) {
	ext := NewHeaderExtractor("X-Custom-Header")

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Custom-Header", "custom-value")

	ctx := &RequestContext{
		Request: req,
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "custom-value" {
		t.Errorf("expected custom-value, got %s", val)
	}
}

func TestQueryExtractor(t *testing.T) {
	ext := NewQueryExtractor("user_id")

	u, _ := url.Parse("/test?user_id=query123")
	req := &http.Request{URL: u}

	ctx := &RequestContext{
		Request: req,
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "query123" {
		t.Errorf("expected query123, got %s", val)
	}
}

func TestBuildKey(t *testing.T) {
	ipExt := NewIPExtractor()
	pathExt := NewPathExtractor("/api/*")

	ctx := &RequestContext{
		IP:   "192.168.1.1",
		Path: "/api/v1/users",
	}

	key, err := BuildKey([]Extractor{ipExt, pathExt}, ctx)
	if err != nil {
		t.Fatal(err)
	}

	expected := "ip=192.168.1.1|path=/api/*"
	if key != expected {
		t.Errorf("expected %s, got %s", expected, key)
	}
}

func TestNewExtractor(t *testing.T) {
	tests := []struct {
		name     string
		dimType  DimensionType
		dimName  string
		wantType DimensionType
		wantNil  bool
	}{
		{"ip", DimensionIP, "", DimensionIP, false},
		{"user_id", DimensionUserID, "", DimensionUserID, false},
		{"path", DimensionPath, "", DimensionPath, false},
		{"service", DimensionService, "", DimensionService, false},
		{"region", DimensionRegion, "", DimensionRegion, false},
		{"header", DimensionHeader, "X-Test", DimensionHeader, false},
		{"query", DimensionQuery, "param", DimensionQuery, false},
		{"unknown", "unknown", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dim := Dimension{
				Type: tt.dimType,
				Name: tt.dimName,
			}
			ext, err := NewExtractor(dim)
			if tt.wantNil {
				if ext != nil {
					t.Errorf("expected nil, got %v", ext)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if ext == nil {
				t.Fatal("expected extractor, got nil")
			}
			if ext.GetType() != tt.wantType {
				t.Errorf("expected type %s, got %s", tt.wantType, ext.GetType())
			}
		})
	}
}

func TestServiceExtractor(t *testing.T) {
	ext := NewServiceExtractor("")

	ctx := &RequestContext{
		Service: "user-service",
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "user-service" {
		t.Errorf("expected user-service, got %s", val)
	}

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Service-Name", "order-service")
	ctx2 := &RequestContext{
		Request: req,
	}

	val, err = ext.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "order-service" {
		t.Errorf("expected order-service from header, got %s", val)
	}
}

func TestRegionExtractor(t *testing.T) {
	ext := NewRegionExtractor("")

	ctx := &RequestContext{
		Region: "us-east-1",
	}

	val, err := ext.Extract(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != "us-east-1" {
		t.Errorf("expected us-east-1, got %s", val)
	}

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Region", "eu-west-1")
	ctx2 := &RequestContext{
		Request: req,
	}

	val, err = ext.Extract(ctx2)
	if err != nil {
		t.Fatal(err)
	}
	if val != "eu-west-1" {
		t.Errorf("expected eu-west-1 from header, got %s", val)
	}
}
