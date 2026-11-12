import * as readline from 'readline';

interface JudgeQuestion {
  question: string;
  category: string;
  idealKeywords: string[];
  feedbackTip: string;
}

export class InteractiveJudge {
  private questions: JudgeQuestion[] = [
    {
      category: 'Architecture',
      question: 'Judge: How does your system guarantee that frontend route calls match backend endpoints?',
      idealKeywords: ['static', 'regex', 'normalize', 'ast', 'parameter', 'contract'],
      feedbackTip: 'Tip: Mention path normalization (e.g., standardizing :id and {id} into :param) and AST-free static analysis.'
    },
    {
      category: 'Failure Modes',
      question: 'Judge: What happens if two developers push conflicting changes while Turbo Mode is active?',
      idealKeywords: ['halt', 'conflict', 'abort', 'porcelain', 'upstream', 'prevent', 'diverge'],
      feedbackTip: 'Tip: Emphasize that Turbo Mode checks git divergence and porcelain conflict codes to halt immediately rather than force-pushing.'
    },
    {
      category: 'Security',
      question: 'Judge: How do you prevent developers from leaking OpenAI or Gemini API keys to public repositories?',
      idealKeywords: ['vault', 'regex', 'gitignore', 'env', 'scan', 'secret', 'pre-flight'],
      feedbackTip: 'Tip: Highlight your regex pattern matching for sk- and AIzaSy keys and .gitignore enforcement.'
    }
  ];

  /**
   * Runs the interactive terminal judge Q&A session.
   */
  public async startSession(): Promise<void> {
    console.log('\n🧑‍⚖️ \x1b[1m\x1b[35mRepoPilot AI Judge Q&A Simulator\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    console.log('A senior hackathon judge is reviewing your project.');
    console.log('Type your verbal answer and press [Enter] to submit each defense.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let totalScore = 0;

    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions[i];
      console.log(`\n\x1b[1m\x1b[33m[Question ${i + 1}/${this.questions.length}] (${q.category})\x1b[0m`);
      console.log(`\x1b[1m${q.question}\x1b[0m`);

      const answer = await new Promise<string>((resolve) => {
        rl.question('\nYour Defense > ', (input) => resolve(input.trim()));
      });

      const score = this.evaluateAnswer(answer, q);
      totalScore += score;

      console.log(`\n📊 \x1b[1mJudge Rating: ${score}/10\x1b[0m`);
      if (score >= 8) {
        console.log('   \x1b[32m✔ Excellent answer! Clear technical justification and domain mastery.\x1b[0m');
      } else if (score >= 5) {
        console.log('   \x1b[33m▲ Good attempt, but could be stronger.\x1b[0m');
        console.log(`   💡 ${q.feedbackTip}`);
      } else {
        console.log('   \x1b[31m✘ Answer was too brief or missed critical technical concepts.\x1b[0m');
        console.log(`   💡 ${q.feedbackTip}`);
      }
      console.log('──────────────────────────────────────────────────');
    }

    rl.close();

    const average = (totalScore / this.questions.length).toFixed(1);
    console.log(`\n🎉 \x1b[1mJudge Q&A Evaluation Complete!\x1b[0m`);
    console.log(`🏆 Final Pitch Readiness Score: \x1b[1m\x1b[32m${average} / 10\x1b[0m`);
    console.log('Tip: Check docs/JUDGE_QNA.md for complete written defense scripts.\n');
  }

  private evaluateAnswer(answer: string, q: JudgeQuestion): number {
    if (!answer || answer.length < 10) {
      return 2;
    }

    let score = 5;
    const lower = answer.toLowerCase();

    // Word count bonus
    if (answer.split(/\s+/).length > 25) {
      score += 2;
    }

    // Keyword matching bonus
    const matched = q.idealKeywords.filter((k) => lower.includes(k));
    score += Math.min(3, matched.length);

    return Math.min(10, score);
  }
}
