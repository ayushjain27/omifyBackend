import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export const generateToken = async (
  claims: Record<string, unknown>,
  signingOptions: Record<string, unknown> = {
    expiresIn: "365d"
  }
): Promise<string> => {
  return jwt.sign(
    {
      ...claims,
      ...{ iss: createHash('sha256').update("OMIFY").digest('hex') }
    },
   "OMIFY_SECRET",
    signingOptions
  );
};
