import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { config } from '../config'
import { Role } from '../types'

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      throw new Error('用户名或密码错误')
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new Error('用户名或密码错误')
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      config.jwtSecret as string,
      { expiresIn: config.jwtExpiresIn as any }
    )

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    }
  },

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10)
  },

  async createUser(data: {
    username: string
    password: string
    name: string
    role: Role
    employeeId?: string
    studentId?: string
    departmentId?: string
    email?: string
    phone?: string
  }) {
    const hashedPassword = await this.hashPassword(data.password)
    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    })
  },
}
