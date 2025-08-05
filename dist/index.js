"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const httpm = __importStar(require("@actions/http-client"));
async function run() {
    try {
        const username = core.getInput('user', { required: true });
        const tokenServiceUrl = core.getInput('token-service-url', { required: true });
        const audience = core.getInput('audience') || 'api.nuget.org';
        // Get OIDC environment values
        const oidcRequestToken = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
        const oidcRequestUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL'];
        if (!oidcRequestToken || !oidcRequestUrl) {
            throw new Error('Missing GitHub OIDC request environment variables.');
        }
        const tokenUrl = `${oidcRequestUrl}&audience=${encodeURIComponent(audience)}`;
        core.info(`Requesting GitHub OIDC token from: ${tokenUrl}`);
        const http = new httpm.HttpClient();
        const tokenResponse = await http.getJson(tokenUrl, {
            Authorization: `Bearer ${oidcRequestToken}`,
        });
        if (!tokenResponse.result || !tokenResponse.result.value) {
            throw new Error('Failed to retrieve OIDC token from GitHub.');
        }
        const oidcToken = tokenResponse.result.value;
        // Build the request body
        const body = JSON.stringify({
            username: username,
            tokenType: 'ApiKey'
        });
        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${oidcToken}`,
            'User-Agent': 'nuget/login-action'
        };
        const tokenServiceHttpClient = new httpm.HttpClient();
        const response = await tokenServiceHttpClient.post(tokenServiceUrl, body, headers);
        if (response.message.statusCode !== 200) {
            const errorBody = await response.readBody();
            throw new Error(`Token exchange failed (${response.message.statusCode}): ${errorBody}`);
        }
        const responseBody = await response.readBody();
        const data = JSON.parse(responseBody);
        if (!data.apiKey) {
            throw new Error('Response did not contain "apiKey".');
        }
        const apiKey = data.apiKey;
        core.setSecret(apiKey);
        core.setOutput('NUGET_API_KEY', apiKey);
        core.info('Successfully exchanged OIDC token for NuGet API key.');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('Unknown error occurred');
        }
    }
}
run();
