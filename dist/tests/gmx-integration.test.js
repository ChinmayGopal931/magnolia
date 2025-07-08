"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GMXService_1 = require("../services/gmx/GMXService");
const chai_1 = require("chai");
const mocha_1 = require("mocha");
(0, mocha_1.describe)('GMX Integration Tests', function () {
    // Increase timeout for GMX API calls
    this.timeout(10000); // 10 seconds
    let gmxService;
    (0, mocha_1.before)(async function () {
        // Initialize GMX service
        gmxService = GMXService_1.GMXService.getInstance();
        try {
            // Initialize SDK with a read-only client for fetching market data
            await gmxService.initializeReadOnly();
            console.log('GMX SDK initialized successfully for integration tests');
        }
        catch (error) {
            console.error('Failed to initialize GMX SDK for integration tests:', error);
            throw error; // Fail tests if initialization fails
        }
    });
    (0, mocha_1.describe)('Market Data', function () {
        (0, mocha_1.it)('should retrieve market data', async function () {
            try {
                const markets = await gmxService.getMarkets();
                console.log('Markets:', markets);
                (0, chai_1.expect)(markets).to.be.an('array');
                if (markets.length > 0) {
                    (0, chai_1.expect)(markets[0]).to.have.property('marketAddress');
                    (0, chai_1.expect)(markets[0]).to.have.property('indexToken');
                }
            }
            catch (error) {
                console.error('Error retrieving markets:', error);
                throw error;
            }
        });
        (0, mocha_1.it)('should retrieve market info by address', async function () {
            try {
                // First get all markets
                const markets = await gmxService.getMarkets();
                if (markets.length > 0) {
                    // Then get details for the first market
                    const marketAddress = markets[0].marketAddress;
                    const marketInfo = await gmxService.getMarketInfo(marketAddress);
                    console.log('Market Info:', marketInfo);
                    (0, chai_1.expect)(marketInfo).to.not.be.null;
                    (0, chai_1.expect)(marketInfo).to.have.property('marketAddress').equal(marketAddress);
                }
                else {
                    console.log('No markets available to test');
                    // Skip test if no markets are available
                    return;
                }
            }
            catch (error) {
                console.error('Error retrieving market info:', error);
                throw error;
            }
        });
    });
    // Note: The following tests require a connected wallet and are commented out
    // They can be used for manual testing with a real wallet
    /*
    describe('Wallet Connection', () => {
      it('should initialize with a wallet', async () => {
        // This test requires a real wallet and provider
        // For manual testing only
        const walletAddress = '0x...'; // Replace with a real wallet address
        const provider = {}; // Replace with a real provider
        
        await gmxService.initialize(walletAddress, provider);
        // No assertion needed, if it doesn't throw an error, it's successful
      });
    });
  
    describe('Position Management', () => {
      it('should get positions for a wallet', async () => {
        // This test requires a real wallet with positions
        // For manual testing only
        const walletAddress = '0x...'; // Replace with a real wallet address
        
        const positions = await gmxService.getPositions(walletAddress);
        console.log('Positions:', positions);
        
        expect(positions).to.be.an('array');
      });
  
      it('should create a long position', async () => {
        // This test requires a real wallet and funds
        // For manual testing only
        const params = {
          marketAddress: '0x...', // Replace with a real market address
          initialCollateralAddress: '0x...', // Replace with a real token address
          initialCollateralAmount: '1000000', // Amount in smallest units
          sizeDeltaUsd: '10000000000', // 10 USD in smallest units
          acceptablePrice: '1000000000', // Price in smallest units
          isLong: true
        };
        
        const txnHash = await gmxService.createLongPosition(params);
        console.log('Transaction Hash:', txnHash);
        
        expect(txnHash).to.be.a('string');
        expect(txnHash).to.not.be.empty;
      });
    });
    */
});
//# sourceMappingURL=gmx-integration.test.js.map