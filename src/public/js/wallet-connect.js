// Simple Wallet Connection Script for GMX Integration

class WalletConnector {
  constructor() {
    this.isConnected = false;
    this.address = null;
    this.chainId = null;
    this.provider = null;
  }

  async init() {
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      this.provider = window.ethereum;
      
      // Handle account changes
      this.provider.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          this.handleDisconnect();
        } else {
          // Account changed
          this.address = accounts[0];
          this.updateUI();
        }
      });
      
      // Handle chain changes
      this.provider.on('chainChanged', (chainId) => {
        this.chainId = chainId;
        this.updateUI();
      });
      
      // Check if already connected
      try {
        const accounts = await this.provider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.address = accounts[0];
          this.chainId = await this.provider.request({ method: 'eth_chainId' });
          this.isConnected = true;
          this.updateUI();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    } else {
      console.log('MetaMask not installed');
      document.getElementById('wallet-status').textContent = 'MetaMask not installed';
    }
  }

  async connect() {
    try {
      // Request account access
      const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
      this.address = accounts[0];
      this.chainId = await this.provider.request({ method: 'eth_chainId' });
      this.isConnected = true;
      
      // Check if on Arbitrum
      if (this.chainId !== '0xa4b1') { // 0xa4b1 is Arbitrum One
        alert('Please switch to Arbitrum network');
        await this.switchToArbitrum();
      }
      
      // Register wallet with backend
      await this.registerWallet();
      
      this.updateUI();
      return this.address;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return null;
    }
  }

  async switchToArbitrum() {
    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa4b1' }], // Arbitrum One
      });
    } catch (error) {
      // If chain doesn't exist, add it
      if (error.code === 4902) {
        await this.addArbitrumNetwork();
      } else {
        console.error('Error switching network:', error);
      }
    }
  }

  async addArbitrumNetwork() {
    try {
      await this.provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0xa4b1',
            chainName: 'Arbitrum One',
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://arb1.arbitrum.io/rpc'],
            blockExplorerUrls: ['https://arbiscan.io/'],
          },
        ],
      });
    } catch (error) {
      console.error('Error adding Arbitrum network:', error);
    }
  }

  async registerWallet() {
    try {
      // Generate a nonce from the server
      const nonceResponse = await fetch('/api/gmx/auth/nonce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: this.address }),
      });
      
      const { nonce } = await nonceResponse.json();
      
      // Sign the nonce
      const message = `Sign this message to connect your wallet to Magnolia: ${nonce}`;
      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, this.address],
      });
      
      // Verify signature with backend
      const verifyResponse = await fetch('/api/gmx/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: this.address,
          signature,
          nonce,
        }),
      });
      
      const result = await verifyResponse.json();
      
      if (result.success) {
        localStorage.setItem('gmx_auth_token', result.token);
        return true;
      } else {
        console.error('Failed to verify wallet signature');
        return false;
      }
    } catch (error) {
      console.error('Error registering wallet:', error);
      return false;
    }
  }

  handleDisconnect() {
    this.isConnected = false;
    this.address = null;
    localStorage.removeItem('gmx_auth_token');
    this.updateUI();
  }

  updateUI() {
    const statusElement = document.getElementById('wallet-status');
    const connectButton = document.getElementById('connect-wallet');
    const disconnectButton = document.getElementById('disconnect-wallet');
    const addressElement = document.getElementById('wallet-address');
    
    if (this.isConnected) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'connected';
      connectButton.style.display = 'none';
      disconnectButton.style.display = 'block';
      addressElement.textContent = `${this.address.substring(0, 6)}...${this.address.substring(38)}`;
      addressElement.style.display = 'block';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'disconnected';
      connectButton.style.display = 'block';
      disconnectButton.style.display = 'none';
      addressElement.style.display = 'none';
    }
  }

  async signMessage(message) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await this.provider.request({
        method: 'personal_sign',
        params: [message, this.address],
      });
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }

  getAuthToken() {
    return localStorage.getItem('gmx_auth_token');
  }
}

// Initialize wallet connector
const walletConnector = new WalletConnector();

// Setup event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  walletConnector.init();
  
  document.getElementById('connect-wallet').addEventListener('click', async () => {
    await walletConnector.connect();
  });
  
  document.getElementById('disconnect-wallet').addEventListener('click', () => {
    walletConnector.handleDisconnect();
  });
});
