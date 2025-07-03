import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export interface AgentApprovalParams {
  agentAddress: string;
  agentName?: string;
  signature: string | { r: string; s: string; v: number };
  useTestnet: boolean;
  action: any
}

export interface ApprovalResponse {
  success: boolean;
  error?: string;
  needsDeposit?: boolean;
}

export class HyperliquidAPI {
  /**
   * Approve agent using direct HTTP call to Hyperliquid exchange API
   */
  static async approveAgent(params: AgentApprovalParams): Promise<ApprovalResponse> {
    try {
      console.log('🔐 === APPROVE AGENT DEBUG START ===');
      console.log('🔐 Input params:', {
        agentAddress: params.agentAddress,
        agentName: params.agentName,
        signatureStart: params.signature,
        signatureEnd: params.signature,
        useTestnet: params.useTestnet
      });

      const { agentAddress, agentName = 'Hyper-rektAgent', signature, useTestnet } = params;
      
      // Validate signature format - accept both string and RSV object
      if (!signature) {
        console.error('❌ No signature provided');
        throw new Error('Signature is required');
      }

      if (typeof signature !== 'string' && 
          !(typeof signature === 'object' && signature.r && signature.s && typeof signature.v === 'number')) {
        console.error('❌ Invalid signature format:', signature);
        throw new Error('Signature must be hex string or RSV object');
      }

      console.log('🔐 Signature validation passed');

      const nonce = Date.now();
      console.log('🔐 Generated nonce:', nonce);

      // Create action according to Hyperliquid API docs
      const action = {
        type: 'approveAgent',
        hyperliquidChain: useTestnet ? 'Testnet' : 'Mainnet',
        signatureChainId: useTestnet ? '0x66eee' : '0xa4b1', // Arbitrum Sepolia : Arbitrum One
        agentAddress,
        agentName: agentName || "",
        nonce
      };

      console.log('🔐 Action before cleanup:', JSON.stringify(action, null, 2));

      // Clean up empty agentName like the SDK does
      if (action.agentName === "") {
        delete (action as any).agentName;
        console.log('🔐 Removed empty agentName from action');
      }

      console.log('🔐 Action after cleanup:', JSON.stringify(action, null, 2));

      // Use signature as-is (SDK returns RSV object which is what API expects)
      console.log('🔐 Using signature as provided by SDK:', signature);

      // Prepare request body according to API docs
      const requestBody = {
        action,
        signature: signature, // Use as-is (RSV object or hex string)
        nonce
      };

      const baseUrl = useTestnet 
        ? 'https://api.hyperliquid-testnet.xyz' 
        : 'https://api.hyperliquid.xyz';

      console.log('🔐 Base URL:', baseUrl);
      console.log('🔐 Full request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${baseUrl}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('🔐 Response status:', response.status);
      console.log('🔐 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('🔐 Raw response body:', responseText);

      if (!response.ok) {
        console.error('❌ HTTP Error - Status:', response.status);
        console.error('❌ HTTP Error - Response:', responseText);
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
        console.log('🔐 Parsed response:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.error('❌ Failed to parse response as JSON:', responseText);
        console.error('❌ Parse error:', e);
        throw new Error('Invalid JSON response from exchange');
      }

      console.log('🔐 Checking response status...');
      if (result.status === 'ok') {
        console.log(`✅ Agent ${agentAddress} approved successfully!`);
        console.log('🔐 === APPROVE AGENT DEBUG END - SUCCESS ===');
        return { success: true };
      } else {
        const errorMessage = result.error?.message || result.message || JSON.stringify(result);
        console.error('❌ Agent approval failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('🔐 === APPROVE AGENT DEBUG END - ERROR ===');
      console.error('❌ Error approving agent:', error.message);
      console.error('❌ Full error:', error);

      // Check for specific deposit requirement error
      if (error.message?.includes('Must deposit before performing actions') ||
          error.message?.includes('insufficient funds') ||
          error.message?.includes('account does not exist')) {
        return {
          success: false,
          needsDeposit: true,
          error: 'You need to deposit funds to Hyperliquid before approving an agent wallet.'
        };
      }

      // Check for signature/nonce errors
      if (error.message?.includes('Invalid signature') ||
          error.message?.includes('nonce')) {
        return {
          success: false,
          error: 'Invalid signature or nonce. Please try again.'
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to approve agent'
      };
    }
  }
}