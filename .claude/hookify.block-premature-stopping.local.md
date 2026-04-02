---
name: block-premature-stopping
enabled: true
event: stop
pattern: (seguimos|dejamos|continúe|próxima sesión|sesión dedicada|lo dejamos|retomar mañana|querés que (siga|continúe|pare)|should (we|I) (continue|stop|pause)|next session|dedicated session|leave (it|this) for|shall I proceed|do you want me to (continue|stop|proceed)|pick this up|resume (later|tomorrow|next)|separate session|another session|wrap up|call it|stopping point)
action: block
---

🛑 **BLOCKED: Premature stopping detected**

You are attempting to stop or suggest pausing work. Your instructions say:

> "Never Stop Until Complete" — When work remains, keep going. Only stop for genuine blockers that require the user's decision.

**Check before stopping:**
1. Is there remaining work from the current task? → Keep going
2. Is there context budget remaining? → Keep going
3. Is there a genuine blocker requiring user input? → Ask about THE BLOCKER, not whether to continue

**You may NOT:**
- Suggest "leaving this for the next session"
- Ask "should we continue?"
- Propose "this needs a dedicated session"
- Offer to "wrap up" or "call it a day"

Go back and continue working on the task.
