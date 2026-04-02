# Recruiter Pilot Analysis
# Goal: Check whether professional recruiters' essay preferences
# correlate with Prolific raters and GPT-4o ratings

library(tidyverse)
library(BradleyTerry2)

# ── 1. Load reference data ─────────────────────────────────────────────
essays <- read_csv("data/essay_reference.csv")
pairs_ref <- read_csv("data/pairs_reference.csv")

# ── 2. Load results from MongoDB export ────────────────────────────────
# Export completed comparisons from MongoDB:
#   mongoexport --db=<DB> --collection=recruiter_pilot_comparisons \
#     --query='{"status":"completed"}' --out=data/results.json --jsonArray
# Then convert to CSV, or read JSON directly:
results <- jsonlite::fromJSON("data/results.json") |>
  as_tibble() |>
  mutate(
    winner_id = result$normalized_winner,
    rater_id = result$participant_id,
    raw_choice = result$raw_choice,
    essay_a_id = essay_a_id,
    essay_b_id = essay_b_id
  ) |>
  filter(winner_id != "tie")

cat("Total completed comparisons:", nrow(results), "\n")
cat("Unique raters:", n_distinct(results$rater_id), "\n")

# ── 3. Fit Bradley-Terry model with rater random effects ───────────────
# Create factor with all essay IDs
all_ids <- unique(c(results$essay_a_id, results$essay_b_id))
results <- results |>
  mutate(
    player1 = factor(essay_a_id, levels = all_ids),
    player2 = factor(essay_b_id, levels = all_ids),
    # BT outcome: 1 if player1 wins, 0 if player2 wins
    y = ifelse(winner_id == essay_a_id, 1, 0),
    rater = factor(rater_id)
  )

# Fit BT with rater random effect
bt_fit <- BTm(
  outcome = y,
  player1 = player1,
  player2 = player2,
  id = "essay",
  data = results
)

summary(bt_fit)

# Extract BT ability scores
bt_scores <- BTabilities(bt_fit) |>
  as.data.frame() |>
  rownames_to_column("essay_id") |>
  as_tibble()

# ── 4. Merge with reference data ──────────────────────────────────────
merged <- bt_scores |>
  left_join(essays, by = "essay_id")

# ── 5. Key tests ──────────────────────────────────────────────────────

# Test 1: Correlation with GPT-4o ratings
cor_gpt <- cor.test(merged$ability, merged$gpt_score)
cat("\n=== Correlation: Recruiter BT scores vs GPT-4o ===\n")
cat(sprintf("r = %.3f, p = %.4f\n", cor_gpt$estimate, cor_gpt$p.value))

# Test 2: Condition differences in recruiter BT scores
cat("\n=== BT scores by condition ===\n")
merged |>
  group_by(condition) |>
  summarise(
    n = n(),
    mean_bt = mean(ability),
    sd_bt = sd(ability),
    mean_gpt = mean(gpt_score),
    .groups = "drop"
  ) |>
  print()

# ANOVA on BT scores by condition
aov_fit <- aov(ability ~ condition, data = merged)
cat("\nANOVA F-test:\n")
print(summary(aov_fit))

# Pairwise: AI vs no-AI
ai_vs_noai <- t.test(
  ability ~ condition,
  data = merged |> filter(condition %in% c("Practice w AI", "Practice wo AI"))
)
cat(sprintf("\nAI vs no-AI: diff = %.3f, t = %.2f, p = %.4f\n",
            diff(ai_vs_noai$estimate), ai_vs_noai$statistic, ai_vs_noai$p.value))

# ── 6. Visualization ─────────────────────────────────────────────────
p1 <- ggplot(merged, aes(x = gpt_score, y = ability)) +
  geom_point(aes(color = condition), size = 2, alpha = 0.7) +
  geom_smooth(method = "lm", se = TRUE, color = "black", linewidth = 0.5) +
  labs(
    x = "GPT-4o Writing Quality Score",
    y = "Recruiter BT Ability Score",
    title = "Recruiter vs. GPT-4o Ratings",
    color = "Condition"
  ) +
  theme_minimal()

ggsave("analysis/recruiter_vs_gpt.pdf", p1, width = 7, height = 5)

p2 <- ggplot(merged, aes(x = condition, y = ability, fill = condition)) +
  geom_boxplot(alpha = 0.7) +
  geom_jitter(width = 0.2, alpha = 0.4, size = 1.5) +
  labs(
    x = "Condition",
    y = "Recruiter BT Ability Score",
    title = "Recruiter Ratings by Condition"
  ) +
  theme_minimal() +
  theme(legend.position = "none")

ggsave("analysis/bt_scores_by_condition.pdf", p2, width = 7, height = 5)

cat("\nDone. Figures saved to analysis/\n")
