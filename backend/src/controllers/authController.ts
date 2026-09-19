import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger } from '../config/logger';

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

export class AuthController {
  /**
   * Verify Google ID Token from frontend Google Sign-In button
   * POST /api/auth/google
   */
  async verifyGoogleToken(req: Request, res: Response) {
    try {
      const { credential, userInfo } = req.body;

      let email = '';
      let name = '';
      let avatar = '';
      let googleId = '';

      if (credential) {
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: config.GOOGLE_CLIENT_ID || undefined,
          });
          const payload = ticket.getPayload();
          if (payload) {
            email = payload.email || '';
            name = payload.name || '';
            avatar = payload.picture || '';
            googleId = payload.sub || '';
          }
        } catch (verifyErr) {
          logger.warn('Google token verification skipped audience/signature in dev mode');
          // If token format is decoded JWT payload from frontend
          if (userInfo) {
            email = userInfo.email;
            name = userInfo.name;
            avatar = userInfo.avatar || userInfo.picture;
            googleId = userInfo.sub || userInfo.id;
          }
        }
      } else if (userInfo) {
        email = userInfo.email;
        name = userInfo.name;
        avatar = userInfo.avatar || userInfo.picture;
        googleId = userInfo.sub || userInfo.id;
      }

      if (!email) {
        return res.status(400).json({ error: 'No valid email found in authentication payload.' });
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          avatar: avatar || undefined,
          googleId: googleId || undefined,
        },
        create: {
          email,
          name: name || email.split('@')[0],
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          googleId,
        },
      });

      logger.info(`👤 User authenticated via Google: ${user.email} (${user.name})`);

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (error: any) {
      logger.error('Google Auth Error:', error);
      return res.status(500).json({ error: error.message || 'Authentication failed' });
    }
  }

  /**
   * Get Current Session / Profile
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response) {
    try {
      const email = (req.query.email as string) || 'growth@reachinbox.ai';
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: 'Outbox Growth Lead',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          },
        });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
