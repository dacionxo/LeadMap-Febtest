# CodeRabbit Review Instructions

## Current Status

A test branch has been created with changes ready for CodeRabbit review:
- **Branch:** `test-coderabbit-review`
- **Changes:** TypeScript fixes in cron jobs + CodeRabbit configuration

## To Trigger CodeRabbit Review

### Option 1: Create GitHub Pull Request (Recommended)

CodeRabbit automatically reviews pull requests when `auto_review: true` is set in `.coderabbit.yaml`.

**Steps:**
1. Push the branch to GitHub:
   ```bash
   git push origin test-coderabbit-review
   ```

2. Create a Pull Request on GitHub:
   - Go to your repository on GitHub
   - Click "Compare & pull request"
   - CodeRabbit will automatically review the PR

3. Wait for CodeRabbit review:
   - CodeRabbit will analyze the changes
   - It will post review comments on the PR
   - Check the PR for CodeRabbit's feedback

### Option 2: Use CodeRabbit Extension in Cursor

If the extension supports local reviews:

1. **Open Command Palette:**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "CodeRabbit" to see available commands

2. **Check for Review Commands:**
   - Look for commands like:
     - "CodeRabbit: Review Changes"
     - "CodeRabbit: Analyze Code"
     - "CodeRabbit: Review File"

3. **Review Specific Files:**
   - Open one of the modified files
   - Use CodeRabbit commands to review it

### Option 3: Manual Review Simulation

Since CodeRabbit primarily works with GitHub PRs, here's what it would review:

**Files Changed:**
- `app/api/cron/gmail-watch-renewal/route.ts`
- `app/api/cron/sync-mailboxes/route.ts`
- `app/api/cron/process-emails/route.ts`
- `.coderabbit.yaml`

**What CodeRabbit Will Check:**
- ✅ TypeScript type safety
- ✅ Next.js best practices
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Code maintainability
- ✅ Supabase query optimization

## Next Steps

**To complete the review:**

1. **Push to GitHub:**
   ```bash
   git push origin test-coderabbit-review
   ```

2. **Create PR on GitHub:**
   - Visit: `https://github.com/dacionxo/LeadMap-main/compare/test-coderabbit-review`
   - Click "Create Pull Request"
   - CodeRabbit will automatically review

3. **Check PR Comments:**
   - CodeRabbit will post review comments
   - Address any suggestions
   - Merge when ready

## Current Branch Status

```bash
# View current branch
git branch --show-current

# View changes
git diff main..test-coderabbit-review

# View commit
git log --oneline -1
```

## CodeRabbit Configuration

Your `.coderabbit.yaml` is configured to:
- ✅ Auto-review PRs
- ✅ Review TypeScript/JavaScript files
- ✅ Check security, performance, best practices
- ✅ Focus on Next.js/Supabase patterns

The review will happen automatically when you create the PR!
