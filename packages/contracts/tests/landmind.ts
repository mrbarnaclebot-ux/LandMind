import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Landmind } from "../target/types/landmind";

describe("landmind", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Landmind as Program<Landmind>;

  // PDAs derived from the program's seeds.
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    program.programId
  );

  // NOTE: initialize / initialize_vault require the signer to equal EXPECTED_ADMIN
  // (H-3 guard). On a fresh validator EXPECTED_ADMIN is a placeholder (the program ID),
  // so these happy-path calls will only succeed once EXPECTED_ADMIN is set to a wallet
  // the provider controls. They are written here to exercise the new API surface.

  it("initializes the config (C5 agent counter)", async () => {
    await program.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.config.fetch(configPda);
    console.log("total_agents:", config.totalAgents.toString());
  });

  it("initializes the fee vault", async () => {
    await program.methods
      .initializeVault()
      .accounts({
        authority: provider.wallet.publicKey,
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vault = await program.account.feeVaultState.fetch(vaultStatePda);
    console.log("vault authority:", vault.authority.toBase58());
    console.log("total_deposited:", vault.totalDeposited.toString());
    console.log("total_claimed:", vault.totalClaimed.toString());
  });
});
