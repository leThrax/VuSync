import { Request, Response, NextFunction } from 'express'
import type { AdminConfig } from '../config'

function getClientIp(req: Request): string {
    return req.socket.remoteAddress ?? ''
}

function isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

export function createAdminGate(adminConfig: AdminConfig) {
    return function adminGate(req: Request, res: Response, next: NextFunction): void {
        if (!adminConfig.enabled) {
            res.status(404).send('Not found')
            return
        }

        if (!adminConfig.networkAccessible) {
            const ip = getClientIp(req)
            if (!isLocalhost(ip)) {
                res.status(403).type('text').send(
                    'Admin panel is only accessible from localhost.\n' +
                    'Set admin.networkAccessible = true in vusync.config.json to enable remote access.'
                )
                return
            }
            next()
            return
        }

        // Network-accessible mode: require session auth. Login route is public.
        if (req.path === '/login') {
            next()
            return
        }

        if (!req.session.adminAuthenticated) {
            res.redirect('/admin/login')
            return
        }

        next()
    }
}
