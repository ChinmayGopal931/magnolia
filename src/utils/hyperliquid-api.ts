

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

      const { signature, useTestnet } = params;
      
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


      // Use the original action from the frontend (including its nonce)
      const originalAction = params.action;
      
      // Validate that the original action has the required fields
      if (!originalAction || !originalAction.nonce) {
        throw new Error('Original action with nonce is required from frontend');
      }
      
      const action = {
        type: 'approveAgent',
        hyperliquidChain: useTestnet ? 'Testnet' : 'Mainnet',
        signatureChainId: useTestnet ? '0x66eee' : '0xa4b1',
        agentAddress: originalAction.agentAddress,
        agentName: originalAction.agentName || "",
        nonce: originalAction.nonce // Use the original nonce from frontend
      };


      // Clean up empty agentName like the SDK does
      if (action.agentName === "") {
        delete (action as any).agentName;
      }

      // Prepare request body according to API docs
      const requestBody = {
        action,
        signature: signature, // Use as-is (RSV object or hex string)
        nonce: action.nonce // Use the action's nonce, not a separate one
      };

      const baseUrl = useTestnet 
        ? 'https://api.hyperliquid-testnet.xyz' 
        : 'https://api.hyperliquid.xyz';

      const response = await fetch(`${baseUrl}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      const responseText = await response.text();

      if (!response.ok) {
        console.error('❌ HTTP Error - Status:', response.status);
        console.error('❌ HTTP Error - Response:', responseText);
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse response as JSON:', responseText);
        console.error('❌ Parse error:', e);
        throw new Error('Invalid JSON response from exchange');
      }

      if (result.status === 'ok') {
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