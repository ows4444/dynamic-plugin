- [🧪 Testing \& Quality Gates](#-testing--quality-gates)
- [🤖 AI Code Review Command](#-ai-code-review-command)


## 🧪 Testing & Quality Gates

- **Unit Tests**  
  - Tooling: Jest + ts‑jest  
  - Coverage: ≥ 95% per module; enforce via CI  
- **Integration Tests**  
  - In‑Memory DB (SQLite/Mongo Memory)  
  - Test container pattern (Testcontainers) for Postgres, Redis  
- **E2E Tests**  
  - SuperTest + Jest for API flows  
  - Pact contract tests against consumer schemas  
- **Quality Gates**  
  - Block merges on lint/type‑check/test failures  
  - Auto-generate coverage badges in README  

---


---

## 🤖 AI Code Review Command

Use the following command to trigger an AI-powered code review that will analyze your entire codebase against this specification and generate a focused checklist:

```bash
# AI Code Review Command
consider @TASK.md do your best properly. only make a markdown file only after review everything as a checklist to solve issues in future.
```

**Command Output:** This will generate a new markdown file with:
- ✅ **Automated Issue Detection**: Scan codebase for architectural violations
- 🎯 **Prioritized Action Items**: Critical → High → Medium → Low  
- 📝 **File-Specific Findings**: Exact locations and suggested fixes
- 📊 **Progress Tracking**: Checkboxes for issue resolution status
