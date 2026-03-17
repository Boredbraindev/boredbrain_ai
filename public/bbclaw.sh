#!/bin/bash
# BBClaw - BoredBrain Agent Framework
# Install: curl -fsSL https://boredbrain.app/bbclaw.sh | bash

set -e

echo "========================================"
echo "  BBClaw - BoredBrain Agent Framework"
echo "  Web 4.0 Agentic Intelligence"
echo "========================================"
echo ""

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Python 3 is required. Install it first."; exit 1; }
command -v pip3 >/dev/null 2>&1 || command -v pip >/dev/null 2>&1 || { echo "ERROR: pip is required."; exit 1; }

echo "[1/3] Installing dependencies..."
pip3 install --user requests websockets eth-account 2>/dev/null || pip install --user requests websockets eth-account 2>/dev/null

# Create bbclaw CLI wrapper
INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

echo "[2/3] Installing bbclaw CLI to $INSTALL_DIR..."

cat > "$INSTALL_DIR/bbclaw" << 'BBCLAW_SCRIPT'
#!/usr/bin/env python3
"""BBClaw - BoredBrain Agent CLI
Web 4.0 Agentic Intelligence Framework

Usage:
  bbclaw register   Register a new agent on the BoredBrain network
  bbclaw status     Check agent status and BBAI balance
  bbclaw invoke     Invoke an agent on the network
  bbclaw help       Show this help message
"""
import sys, json, os

API_BASE = os.environ.get("BBCLAW_API", "https://boredbrain.app/api")
CONFIG_DIR = os.path.expanduser("~/.bbclaw")
CONFIG_PATH = os.path.join(CONFIG_DIR, "agent.json")

def _load_config():
    if not os.path.exists(CONFIG_PATH):
        return None
    with open(CONFIG_PATH) as f:
        return json.load(f)

def _save_config(config):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def _get_arg(args, flag, prompt=None):
    if flag in args:
        idx = args.index(flag)
        if idx + 1 < len(args):
            return args[idx + 1]
    if prompt:
        return input(prompt)
    return None

def register(args):
    """Register a new agent on the BoredBrain network (with wallet signature)"""
    import requests, time

    name = _get_arg(args, "--name", "Agent name: ")
    wallet = _get_arg(args, "--wallet", "Wallet address (0x...): ")
    key = _get_arg(args, "--key", "Private key (0x... for signing, never sent to server): ")
    spec = _get_arg(args, "--spec", "Specialization (trading/defi/research/security/nft/news/creative/general): ")
    desc = _get_arg(args, "--desc", "Description: ")

    if not name or not wallet:
        print("ERROR: Name and wallet address are required.")
        sys.exit(1)

    # Sign registration message with private key
    timestamp = int(time.time() * 1000)
    message = f"BoredBrain Agent Registration\nWallet: {wallet.strip()}\nAgent: {name.strip()}\nTimestamp: {timestamp}"
    signature = None

    if key:
        try:
            from eth_account.messages import encode_defunct
            from eth_account import Account
            msg = encode_defunct(text=message)
            signed = Account.sign_message(msg, private_key=key.strip())
            signature = signed.signature.hex()
            if not signature.startswith("0x"):
                signature = "0x" + signature
            print(">> Wallet signature created successfully")
        except ImportError:
            print("WARNING: eth-account not installed. Run: pip install eth-account")
            print(">> Falling back to web registration...")
            print(f">> Complete at: https://boredbrain.app/agents/register")
            return
        except Exception as e:
            print(f"ERROR: Failed to sign message: {e}")
            return
    else:
        print(">> No private key provided. Opening web registration...")
        print(f">> Complete at: https://boredbrain.app/agents/register")
        # Save config locally even without registration
        config = {"name": name.strip(), "wallet": wallet.strip(), "specialization": spec or "general", "api": API_BASE}
        _save_config(config)
        return

    slug = name.strip().lower().replace(" ", "-")
    print(f"\n>> Registering agent '{name}' on BoredBrain network...")

    # Register via API with signature proof
    try:
        r = requests.post(f"{API_BASE}/agents/register", json={
            "name": name.strip(),
            "description": desc or f"{name} - registered via BBClaw CLI",
            "ownerAddress": wallet.strip(),
            "specialization": spec or "general",
            "tools": [],
            "isDemo": False,
            "signature": signature,
            "message": message,
            "timestamp": timestamp,
            "agentCardUrl": f"https://boredbrain.app/api/agents/{slug}/card",
            "endpoint": f"https://boredbrain.app/api/agents/{slug}/invoke",
            "stakingAmount": 0,
        }, timeout=15)
        data = r.json()
        if r.ok and data.get("agent"):
            agent = data["agent"]
            config = {
                "agentId": agent.get("id"),
                "name": name.strip(),
                "wallet": wallet.strip(),
                "specialization": spec or "general",
                "description": desc or "",
                "api": API_BASE,
                "registeredAt": agent.get("registeredAt"),
            }
            _save_config(config)
            print(f"SUCCESS: Agent registered!")
            print(f"  Agent ID: {agent.get('id')}")
            print(f"  Status:   {agent.get('status')}")
            if data.get("rewardAwarded"):
                print(f"  Reward:   +{data.get('rewardAmount', 1000)} BBAI")
            print(f"\nConfig saved to ~/.bbclaw/agent.json")
            return
        else:
            print(f"API returned: {data.get('error', 'Unknown error')}")
            print("Saving config locally for manual registration...")
    except Exception as e:
        print(f"Could not reach API ({e}). Saving config locally...")

    # Fallback: save config locally
    config = {
        "name": name.strip(),
        "wallet": wallet.strip(),
        "specialization": spec or "general",
        "description": desc or "",
        "api": API_BASE,
    }
    _save_config(config)
    print(f"Config saved to ~/.bbclaw/agent.json")
    print(f"Complete registration at: {API_BASE.replace('/api', '')}/agents/register")
    print(f"You'll receive 1000 BBAI reward upon wallet verification!")

def status(args):
    """Check agent status"""
    import requests
    config = _load_config()
    if not config:
        print("No agent configured. Run: bbclaw register")
        return

    print(f"Agent:  {config.get('name', 'Unknown')}")
    print(f"Wallet: {config.get('wallet', 'Not set')}")
    print(f"Spec:   {config.get('specialization', 'general')}")
    if config.get("agentId"):
        print(f"ID:     {config['agentId']}")
    print("")

    try:
        r = requests.get(f"{config.get('api', API_BASE)}/wallet/status?address={config['wallet']}", timeout=5)
        data = r.json()
        print(f"BBAI Balance:     {data.get('bbaiBalance', 0)}")
        print(f"Tier:             {data.get('tier', 'basic').upper()}")
        print(f"Agent registered: {'Yes' if data.get('hasAgent') else 'No'}")
    except:
        print("Could not reach BoredBrain API. Check your connection.")

def invoke(args):
    """Invoke an agent on the network"""
    import requests
    config = _load_config()

    agent_id = _get_arg(args, "--agent", "Agent ID to invoke: ")
    query = _get_arg(args, "--query", "Query: ")

    if not agent_id or not query:
        print("ERROR: Agent ID and query are required.")
        print("Usage: bbclaw invoke --agent <agent-id> --query <query>")
        return

    api = config.get("api", API_BASE) if config else API_BASE
    wallet = config.get("wallet") if config else None

    print(f"Invoking {agent_id}...")
    try:
        payload = {"query": query}
        if wallet:
            payload["callerAddress"] = wallet
        r = requests.post(f"{api}/agents/{agent_id}/invoke", json=payload, timeout=30)
        data = r.json()
        if r.ok and data.get("result"):
            result = data["result"]
            print(f"\n--- Response from {agent_id} ---")
            print(result.get("response", "No response"))
            print(f"\nTokens: {result.get('tokensUsed', '?')} | Cost: {result.get('cost', '?')} BBAI")
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    except Exception as e:
        print(f"Failed to invoke agent: {e}")

def version(args):
    print("BBClaw v0.1.0 - BoredBrain Agent Framework")
    print("https://boredbrain.app")

def main():
    args = sys.argv[1:]
    if not args or args[0] in ["-h", "--help", "help"]:
        print("BBClaw - BoredBrain Agent Framework")
        print("Web 4.0 Agentic Intelligence")
        print("")
        print("Usage:")
        print("  bbclaw register                  Register a new agent")
        print("  bbclaw status                    Check agent status & balance")
        print("  bbclaw invoke --agent ID --query  Invoke an agent")
        print("  bbclaw version                   Show version")
        print("  bbclaw help                      Show this help")
        print("")
        print("Options:")
        print("  --name NAME       Agent name")
        print("  --wallet ADDR     Wallet address (0x...)")
        print("  --spec TYPE       Specialization")
        print("  --desc TEXT       Description")
        print("  --agent ID        Agent ID for invoke")
        print("  --query TEXT      Query for invoke")
        print("")
        print("Environment:")
        print("  BBCLAW_API        Override API base URL")
        print("")
        print("Docs: https://boredbrain.app/docs")
        print("OpenClaw: https://boredbrain.app/openclaw")
        return

    commands = {
        "register": register,
        "status": status,
        "invoke": invoke,
        "version": version,
        "--version": version,
        "-v": version,
    }

    cmd = args[0]
    if cmd in commands:
        commands[cmd](args[1:])
    else:
        print(f"Unknown command: {cmd}")
        print("Run 'bbclaw help' for usage information.")
        sys.exit(1)

if __name__ == "__main__":
    main()
BBCLAW_SCRIPT

chmod +x "$INSTALL_DIR/bbclaw"

echo "[3/3] Verifying installation..."

# Check if ~/.local/bin is in PATH
if echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo ""
    echo "SUCCESS: BBClaw installed successfully!"
else
    echo ""
    echo "SUCCESS: BBClaw installed successfully!"
    echo ""
    echo "NOTE: Add ~/.local/bin to your PATH:"
    echo '  echo '"'"'export PATH="$HOME/.local/bin:$PATH"'"'"' >> ~/.bashrc'
    echo '  source ~/.bashrc'
fi

echo ""
echo "Quick Start:"
echo "  bbclaw register                    # Register your agent"
echo "  bbclaw status                      # Check status & balance"
echo "  bbclaw invoke --agent ID --query   # Invoke an agent"
echo ""
echo "Docs:     https://boredbrain.app/docs"
echo "OpenClaw: https://boredbrain.app/openclaw"
echo ""
echo "========================================"
echo "  BoredBrain - Web 4.0 Agentic Intelligence"
echo "========================================"
