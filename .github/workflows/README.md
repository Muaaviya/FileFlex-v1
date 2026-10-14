# GitHub Branch Protection Workflow

This repository uses a multi-layered approach to ensure the main branch remains stable and well-vetted.

## Safety Nets in Place

### 1. GitHub Branch Protection Rules (Recommended)

Configure this in **Settings → Branches → Branch protection rules**:

- **Branch**: `main`
- **Require a pull request before merging**: ✅ ON
- **Require approvals**: ✅ ON (minimum 1 approval)
- **Require status checks to pass before merging**: ✅ ON
- **Include administrators**: ✅ ON
- **Restrict pushes to the protected branch**: ✅ ON

### 2. GitHub Actions Workflow Protection

The workflow below provides an additional layer of safety by blocking direct pushes to `main`.

## Workflow Files

- **`main-protection.yml`**: Blocks direct pushes to main with detailed error messages
- This workflow runs on any push to the main branch and fails with instructions

## How to Contribute

### Recommended Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**
   ```bash
   # Edit files, commit changes
   git add .
   git commit -m "feat: description"
   ```

3. **Push to your branch**
   ```bash
   git push origin feature/your-feature
   ```

4. **Open a Pull Request**
   - Navigate to the repository on GitHub
   - Click "New pull request"
   - Select your branch as the source
   - Target the main branch
   - Provide a clear title and description

5. **Get approvals**
   - Request reviews from team members
   - Address feedback
   - Ensure all checks pass

6. **Merge the PR**
   - Navigate to the PR page
   - Click "Merge pull request" or "Rebase and merge"
   - Confirm the merge (you must manually merge)

### Never Do This

❌ **NEVER push directly to main**:
```bash
git push origin main
```

This is blocked by the safety workflow above.

## Why These Rules?

1. **Code Review**: Ensures changes are reviewed by peers
2. **CI/CD Testing**: Enables automatic testing on PRs
3. **Audit Trail**: Creates a history of who made what changes
4. **Reversibility**: Makes it easier to revert problematic changes
5. **Team Collaboration**: Encourages open, transparent development

## Troubleshooting

### If your push to main fails:

```bash
git push origin main
```

```
❌ ERROR: Direct push to main branch detected and blocked.

📋 REQUIRED WORKFLOW:
   1. Create a feature branch from main
   2. Commit your changes to that branch
   3. Open a Pull Request targeting main
   ... (see workflow output)
```

**Solution**: Follow the steps above to create a PR.

## Manual Merge Instructions

When your PR is ready to merge:

1. Navigate to: `https://github.com/[username]/[repo]/pull/[pull-number]`
2. Ensure all required checks pass
3. Ensure you have at least 1 approval
4. Click the "Merge pull request" or "Rebase and merge" button
5. Confirm the merge with a commit message

## Branch Naming Convention

Recommended branch names:
- `feature/`, `bugfix/`, `docs/`, `refactor/`, `test/`

Example: `feature/improve-select-styling`

## Automation

This workflow provides safety, but automated tools can still be used:

- Pre-commit hooks for linting/formatting
- GitHub Actions that run on PR creation/update
- Dependabot for dependency updates (via PRs)
- Any automated process that must still go through PRs

## Questions?

For questions about this workflow, reach out on GitHub, Slack, or ask in team meetings.