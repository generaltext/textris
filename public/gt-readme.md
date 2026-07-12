# Textris

Tetris for General Text, with a leaderboard you can actually trust.

## Play

Standard modern Tetris: 7-bag piece randomizer, SRS rotation with wall kicks, hold, ghost piece, soft and hard drop, line-clear scoring with back-to-back and combo bonuses, and rising gravity as you level up.

- **Move** ← →
- **Soft drop** ↓ · **Hard drop** Space
- **Rotate** ↑ / X (clockwise) · Z (counter-clockwise)
- **Hold** C · **Pause** Esc

Two modes: **Daily**, where everyone gets the same piece sequence for the day so scores compare directly, and **Free play**, a fresh random game every time.

## The leaderboard is unfakeable

Textris does not store your score as a number you could just edit. It stores the **whole game**, the seed plus your exact keypresses, and signs it with a key that's yours. When someone opens the leaderboard, their device replays your game from scratch and works out the score itself. A tampered number won't reproduce, so the only way onto the board is to actually play that well.

You can **watch any run** on the board, replayed move for move.

## Where it lives

Textris writes plaintext files you own, under its data folder:

- `v0/scores/<you>.jsonl`: one signed record per game you play (you only ever write your own file).
- `v0/replays/<run>.txt`: the full, replayable input log for each game.
- `v0/identity.json`: your signing keypair, which stays in your workspace.

Share a workspace with friends and it becomes a live, shared leaderboard: everyone's games sync in, and every device verifies every other player's. There's no server keeping score, and no account beyond the workspace you're already in.

> Honest note: with no server, your identity is your key rather than a verified account, and a determined bot could generate a legitimate replay. What the design does guarantee is that every score on the board is a real, reproducible game that anyone with the files can check.
