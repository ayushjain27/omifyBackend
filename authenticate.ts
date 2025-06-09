import jwt from 'jsonwebtoken';

// Add this middleware before your routes
export const authenticateJWT = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>
    
    jwt.verify(token, 'OMIFY_SECRET', (err: any, user: any) => {
      if (err) {
        return res.sendStatus(403);
      }
      
      req.user = user; // Attach decoded payload to request
      next();
    });
  } else {
    res.sendStatus(401);
  }
};