// 🔐 강화된 JWT 보안 패치
// 이 파일의 내용을 server/src/index.js의 7127-7172 라인에 교체하세요

// 🔐 강화된 JWT 인증 미들웨어
function authenticateJWT(req, res, next) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const host = req.headers.host || 'Unknown';
  const authHeader = req.headers.authorization;
  
  // 🛡️ Bearer 토큰 형식 검증
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`🚨 [SECURITY] Invalid auth header format from IP: ${clientIP}`);
    securityMonitor.logAttack('suspicious', clientIP, 'Invalid Bearer token format');
    return res.status(401).json({ 
      error: "Access token required with Bearer format",
      code: "JWT_MISSING" 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log(`🚨 [SECURITY] Empty JWT token from IP: ${clientIP}`);
    securityMonitor.logAttack('suspicious', clientIP, 'Empty JWT token');
    return res.status(401).json({ 
      error: "Access token required",
      code: "JWT_MISSING" 
    });
  }
  
  // 🛡️ 토큰 길이 검증 (JWT는 최소 길이가 있음)
  if (token.length < 20 || token.length > 2048) {
    console.log(`🚨 [SECURITY] Suspicious token length (${token.length}) from IP: ${clientIP}`);
    securityMonitor.logAttack('suspicious', clientIP, `Invalid token length: ${token.length}`);
    return res.status(401).json({ 
      error: "Invalid token format",
      code: "JWT_INVALID_FORMAT" 
    });
  }
  
  // 🛡️ User-Agent 검증 (봇/자동화 도구 탐지)
  const suspiciousUserAgents = [
    'curl', 'wget', 'python', 'postman', 'insomnia', 'httpie', 
    'bot', 'crawler', 'spider', 'scraper', 'automated'
  ];
  
  const isSuspiciousAgent = suspiciousUserAgents.some(pattern => 
    userAgent.toLowerCase().includes(pattern)
  );
  
  if (isSuspiciousAgent) {
    console.log(`🚨 [SECURITY] Suspicious User-Agent: ${userAgent} from IP: ${clientIP}`);
    securityMonitor.logAttack('suspicious', clientIP, `Suspicious User-Agent: ${userAgent}`);
    // 의심스럽지만 차단하지는 않음 (로그만 남김)
  }
  
  // 🛡️ Host 헤더 검증
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    'fising-master.onrender.com',
    process.env.ALLOWED_HOST || 'localhost'
  ];
  
  const isValidHost = allowedHosts.some(allowedHost => 
    host.includes(allowedHost) || host.startsWith(allowedHost)
  );
  
  if (!isValidHost) {
    console.log(`🚨 [SECURITY] Invalid Host header: ${host} from IP: ${clientIP}`);
    securityMonitor.logAttack('blocked', clientIP, `Invalid Host: ${host}`);
    return res.status(403).json({ 
      error: "Invalid host",
      code: "INVALID_HOST" 
    });
  }
  
  const decoded = verifyJWT(token);
  if (!decoded) {
    console.log(`🚨 [SECURITY] Invalid JWT token from IP: ${clientIP}, User-Agent: ${userAgent}`);
    securityMonitor.logAttack('suspicious', clientIP, 'Invalid JWT token');
    return res.status(403).json({ 
      error: "Invalid or expired token",
      code: "JWT_INVALID" 
    });
  }
  
  // 🛡️ 토큰 만료 시간 추가 검증
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    console.log(`🚨 [SECURITY] Expired JWT token from IP: ${clientIP}, User: ${decoded.username}`);
    securityMonitor.logAttack('suspicious', clientIP, 'Expired JWT token');
    return res.status(403).json({ 
      error: "Token expired",
      code: "JWT_EXPIRED" 
    });
  }
  
  // 요청 객체에 사용자 정보와 보안 정보 추가
  req.user = decoded;
  req.userUuid = decoded.userUuid;
  req.username = decoded.username;
  req.clientIP = clientIP;
  req.userAgent = userAgent;
  req.requestHost = host;
  
  console.log(`🔐 JWT authenticated: ${decoded.username} (${decoded.userUuid}) from IP: ${clientIP}`);
  next();
}

// 🔐 강화된 선택적 JWT 인증 미들웨어
function optionalJWT(req, res, next) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    // Bearer 형식 검증
    if (!authHeader.startsWith('Bearer ')) {
      console.log(`🚨 [SECURITY] Invalid optional auth header from IP: ${clientIP}`);
      securityMonitor.logAttack('suspicious', clientIP, 'Invalid optional Bearer format');
    } else {
      const token = authHeader.split(' ')[1];
      
      if (token && token.length >= 20 && token.length <= 2048) {
        const decoded = verifyJWT(token);
        if (decoded) {
          req.user = decoded;
          req.userUuid = decoded.userUuid;
          req.username = decoded.username;
          req.clientIP = clientIP;
          req.userAgent = userAgent;
          console.log(`🔐 Optional JWT authenticated: ${decoded.username} from IP: ${clientIP}`);
        } else {
          console.log(`🚨 [SECURITY] Invalid optional JWT from IP: ${clientIP}`);
          securityMonitor.logAttack('suspicious', clientIP, 'Invalid optional JWT');
        }
      }
    }
  }
  
  next();
}
