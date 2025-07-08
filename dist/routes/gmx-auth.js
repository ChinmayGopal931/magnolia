"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ethers_1 = require("ethers");
const repositories_1 = require("../db/repositories");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const userRepository = new repositories_1.UserRepository();
const agentRepository = new repositories_1.AgentRepository();
// Store nonces in memory (in production, use Redis or database)
const nonces = {};
// Use the JWT secret from environment variables or a default
const JWT_SECRET = process.env.JWT_SECRET || 'magnolia-dev-secret';
// Generate a nonce for wallet signature
router.post('/nonce', async (req, res) => {
    try {
        console.log('Nonce request body:', req.body);
        // Accept either 'address' or 'walletAddress' for better flexibility
        const address = req.body.address || req.body.walletAddress;
        console.log('Address for nonce generation:', address);
        console.log('Is valid Ethereum address:', address ? ethers_1.ethers.isAddress(address) : false);
        if (!address) {
            return res.status(400).json({ error: 'Missing wallet address' });
        }
        if (!ethers_1.ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        // Generate a random nonce
        const nonce = crypto_1.default.randomBytes(32).toString('hex');
        // Store the nonce (with 5 minute expiration)
        nonces[address.toLowerCase()] = nonce;
        setTimeout(() => {
            delete nonces[address.toLowerCase()];
        }, 5 * 60 * 1000);
        res.json({ nonce });
    }
    catch (error) {
        console.error('Error generating nonce:', error);
        res.status(500).json({ error: error.message });
    }
});
// Verify wallet signature and associate with user
router.post('/verify', async (req, res) => {
    try {
        // Accept either 'address' or 'walletAddress' for better flexibility
        const address = req.body.address || req.body.walletAddress;
        const { signature, nonce, userId } = req.body;
        console.log('Verify request body:', {
            address,
            signatureLength: signature ? signature.length : 0,
            nonce,
            userId
        });
        if (!address || !signature || !nonce) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        const storedNonce = nonces[address.toLowerCase()];
        if (!storedNonce || storedNonce !== nonce) {
            return res.status(400).json({ error: 'Invalid or expired nonce' });
        }
        // Allow a dev-only test signature for development/testing
        if (process.env.NODE_ENV !== 'production' && signature === '0x1234') {
            console.log('DEV/TEST MODE: Bypassing signature verification for test wallet');
        }
        else {
            // Verify the signature (production mode)
            const message = `Sign this message to authenticate with the GMX API: ${nonce}`;
            const recoveredAddress = ethers_1.ethers.verifyMessage(message, signature);
            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }
        // Skip database operations in test/development environment to prevent database connection errors
        if (process.env.NODE_ENV !== 'production') {
            console.log('DEV/TEST MODE: Bypassing database operations for test wallet');
            // Generate a test token with the wallet address
            const token = jsonwebtoken_1.default.sign({
                address: address,
                testMode: true
            }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token });
        }
        // Clear the used nonce
        delete nonces[address.toLowerCase()];
        // Find or create user if userId is not provided
        let user = null;
        if (!userId) {
            // Look up user by wallet address in agents table
            const agent = await agentRepository.getByAddress(address.toLowerCase());
            if (agent) {
                user = await userRepository.getById(agent.user_id);
            }
            if (!user) {
                // Create a new user with a temporary email based on address
                const tempEmail = `${address.toLowerCase().substring(2, 8)}@wallet.magnolia.app`;
                const newUserId = await userRepository.create(tempEmail);
                user = await userRepository.getById(newUserId);
            }
        }
        else {
            user = await userRepository.getById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
        }
        if (!user) {
            return res.status(500).json({ error: 'Failed to create or retrieve user' });
        }
        // Create or update agent for GMX
        let gmxAgent = await agentRepository.getByUserIdAndDex(user.id, 'gmx');
        if (!gmxAgent) {
            const agentId = await agentRepository.create(user.id, 'gmx', address.toLowerCase(), 'approved' // GMX wallets are auto-approved since user controls them
            );
            // Get the full agent record
            const agentWallet = await agentRepository.getById(agentId);
            if (agentWallet) {
                // Fetch the database agent record directly
                gmxAgent = await agentRepository.getByUserIdAndDex(user.id, 'gmx');
            }
        }
        else if (gmxAgent.address !== address.toLowerCase()) {
            // Update agent address if it changed
            await agentRepository.updateAddress(gmxAgent.id, address.toLowerCase());
            // Refresh the agent data
            gmxAgent = await agentRepository.getByUserIdAndDex(user.id, 'gmx');
        }
        if (!gmxAgent) {
            return res.status(500).json({ error: 'Failed to create or retrieve agent' });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            agentId: gmxAgent.id,
            address: address.toLowerCase(),
            dex: 'gmx'
        }, process.env.JWT_SECRET || 'magnolia-dev-secret', { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email
            },
            agent: {
                id: gmxAgent.id,
                address: address.toLowerCase(),
                dex: 'gmx'
            }
        });
    }
    catch (error) {
        console.error('Error verifying wallet:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=gmx-auth.js.map