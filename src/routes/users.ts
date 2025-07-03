import { Router, Request, Response } from 'express';
import { UserRepository } from '../db/repositories';

const router = Router();
const userRepository = new UserRepository();

// Create new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, telegramId } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'email is required' 
      });
    }

    // Check if user already exists
    const existingUser = await userRepository.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          telegramId: existingUser.telegram_id,
          createdAt: existingUser.created_at
        }
      });
    }

    const userId = await userRepository.create(email, telegramId);
    const newUser = await userRepository.getById(userId);
    
    res.status(201).json({
      id: newUser!.id,
      email: newUser!.email,
      telegramId: newUser!.telegram_id,
      createdAt: newUser!.created_at
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'userId is required' 
      });
    }
    
    const user = await userRepository.getById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      telegramId: user.telegram_id,
      createdAt: user.created_at
    });
  } catch (error: any) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by email
router.get('/email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'email is required' 
      });
    }
    
    const user = await userRepository.getByEmail(email);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      telegramId: user.telegram_id,
      createdAt: user.created_at
    });
  } catch (error: any) {
    console.error('Error getting user by email:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;