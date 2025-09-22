// 🛡️ 추가 보안 강화 시스템
// 이 내용을 server/src/index.js에 추가하세요

// 🔐 JWT 토큰 블랙리스트 (메모리 기반)
const tokenBlacklist = new Set();
const suspiciousTokens = new Map(); // 토큰별 의심 활동 추적

// 🛡️ 토큰 블랙리스트 체크 미들웨어
function checkTokenBlacklist(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (tokenBlacklist.has(token)) {
      const clientIP = getClientIP(req);
      console.log(`🚨 [SECURITY] Blacklisted token used from IP: ${clientIP}`);
      securityMonitor.logAttack('blocked', clientIP, 'Blacklisted token usage');
      return res.status(403).json({ 
        error: "Token has been revoked",
        code: "TOKEN_BLACKLISTED" 
      });
    }
  }
  next();
}

// 🛡️ 의심스러운 활동 탐지 미들웨어
function detectSuspiciousActivity(req, res, next) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const authHeader = req.headers.authorization;
  
  // 짧은 시간 내 대량 요청 탐지
  const requestKey = `${clientIP}-${Date.now()}`;
  const timeWindow = 60000; // 1분
  const maxRequests = 100; // 1분에 100개 요청 초과 시 의심
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, []);
  }
  
  const requests = requestCounts.get(clientIP);
  const now = Date.now();
  
  // 1분 이전 요청들 제거
  const recentRequests = requests.filter(time => now - time < timeWindow);
  recentRequests.push(now);
  requestCounts.set(clientIP, recentRequests);
  
  if (recentRequests.length > maxRequests) {
    console.log(`🚨 [SECURITY] High frequency requests from IP: ${clientIP} (${recentRequests.length} req/min)`);
    securityMonitor.logAttack('suspicious', clientIP, `High frequency: ${recentRequests.length} req/min`);
  }
  
  // 동일한 JWT 토큰으로 서로 다른 IP에서 접근 탐지
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (!suspiciousTokens.has(token)) {
      suspiciousTokens.set(token, { ips: new Set(), firstSeen: now });
    }
    
    const tokenInfo = suspiciousTokens.get(token);
    tokenInfo.ips.add(clientIP);
    
    // 동일 토큰이 3개 이상의 서로 다른 IP에서 사용될 경우
    if (tokenInfo.ips.size >= 3) {
      console.log(`🚨 [SECURITY] Token used from multiple IPs: ${Array.from(tokenInfo.ips).join(', ')}`);
      securityMonitor.logAttack('suspicious', clientIP, `Multi-IP token usage: ${tokenInfo.ips.size} IPs`);
      
      // 토큰을 블랙리스트에 추가
      tokenBlacklist.add(token);
      console.log(`🚨 [SECURITY] Token blacklisted due to multi-IP usage`);
    }
  }
  
  next();
}

// 🛡️ 보안 헤더 추가 미들웨어
function addSecurityHeaders(req, res, next) {
  // CORS 보안 강화
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // JWT 토큰 보안
  if (req.headers.authorization) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.header('Pragma', 'no-cache');
  }
  
  next();
}

// 🛡️ 보안 이벤트 로깅 시스템 강화
const securityLogger = {
  events: [],
  maxEvents: 1000,
  
  log(level, type, ip, userAgent, details) {
    const event = {
      timestamp: new Date().toISOString(),
      level: level, // 'info', 'warning', 'critical'
      type: type,   // 'jwt', 'ddos', 'suspicious', 'blocked'
      ip: ip,
      userAgent: userAgent,
      details: details
    };
    
    this.events.unshift(event);
    
    // 최대 이벤트 수 제한
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    
    // 콘솔 출력 (레벨별 색상)
    const colors = {
      info: '\x1b[36m',    // 청록
      warning: '\x1b[33m', // 노랑
      critical: '\x1b[31m' // 빨강
    };
    
    console.log(`${colors[level]}🛡️ [${level.toUpperCase()}] ${type}: ${ip} - ${details}\x1b[0m`);
  },
  
  getRecentEvents(limit = 50) {
    return this.events.slice(0, limit);
  },
  
  getStatsByIP(ip) {
    return this.events.filter(event => event.ip === ip);
  }
};

// 🛡️ 보안 통계 API 확장
app.get('/api/security/detailed-stats', (req, res) => {
  const clientIP = getClientIP(req);
  
  res.json({
    ...securityMonitor.getStats(),
    recentEvents: securityLogger.getRecentEvents(20),
    blacklistedTokens: tokenBlacklist.size,
    suspiciousTokens: suspiciousTokens.size,
    topAttackingIPs: getTopAttackingIPs(),
    timestamp: new Date().toISOString(),
    server: 'fishing-game-server'
  });
});

function getTopAttackingIPs() {
  const ipCounts = {};
  securityLogger.events.forEach(event => {
    if (event.level === 'warning' || event.level === 'critical') {
      ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
    }
  });
  
  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, attacks: count }));
}

// 🛡️ 정기적인 보안 데이터 정리 (메모리 관리)
setInterval(() => {
  const now = Date.now();
  const cleanupAge = 24 * 60 * 60 * 1000; // 24시간
  
  // 오래된 의심스러운 토큰 정보 정리
  for (const [token, info] of suspiciousTokens.entries()) {
    if (now - info.firstSeen > cleanupAge) {
      suspiciousTokens.delete(token);
    }
  }
  
  // 오래된 요청 카운트 정리
  for (const [ip, requests] of requestCounts.entries()) {
    const recentRequests = requests.filter(time => now - time < 60000);
    if (recentRequests.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, recentRequests);
    }
  }
  
  console.log(`🧹 Security data cleanup completed. Tokens: ${suspiciousTokens.size}, IPs: ${requestCounts.size}`);
}, 60 * 60 * 1000); // 1시간마다 정리
