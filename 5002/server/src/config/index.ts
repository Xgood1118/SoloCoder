export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
  jwtExpiresIn: '7d',
  regularScoreWeight: 0.4,
  finalScoreWeight: 0.6,
  passScore: 60,
}

export const GRADE_FORMULA_CONFIG = {
  regularWeight: 0.4,
  finalWeight: 0.6,
  passThreshold: 60,
}
