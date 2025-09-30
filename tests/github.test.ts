import { describe, it, expect } from 'vitest';
import githubService from '../src/services/github';

describe('GitHub Service', () => {
  describe('extractClaudeMention', () => {
    it('should extract instruction after @claude', () => {
      const body = `
Hello there!

@claude Please refactor this code to use TypeScript
and add proper error handling.

Thank you!
      `.trim();

      const result = githubService.extractClaudeMention(body);
      expect(result).toContain('Please refactor this code');
      expect(result).toContain('add proper error handling');
    });

    it('should handle @claude at start of line', () => {
      const body = '@claude Fix the bug in the authentication module';
      const result = githubService.extractClaudeMention(body);
      expect(result).toBe('Fix the bug in the authentication module');
    });

    it('should handle multiline instructions', () => {
      const body = `
@claude Please:
1. Add tests
2. Update documentation
3. Fix linting errors
      `.trim();

      const result = githubService.extractClaudeMention(body);
      expect(result).toContain('Please:');
      expect(result).toContain('1. Add tests');
      expect(result).toContain('3. Fix linting errors');
    });

    it('should return null if no @claude mention', () => {
      const body = 'This is a regular comment without mentions';
      const result = githubService.extractClaudeMention(body);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive @claude', () => {
      const body = '@CLAUDE do something';
      const result = githubService.extractClaudeMention(body);
      expect(result).toBe('do something');
    });
  });
});
