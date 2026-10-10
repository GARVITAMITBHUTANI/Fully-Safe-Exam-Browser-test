import { NavigationGuard } from '../src/Browser/NavigationGuard';
import { DEFAULT_EXAM_CONFIGURATION } from '../src/Configuration/ExamConfiguration';

export function runNavigationTests() {
  console.log('\n--- Running NavigationGuard Tests ---');

  const config = {
    ...DEFAULT_EXAM_CONFIGURATION,
    startUrl: 'https://exam.university.edu/login',
    allowedUrls: [
      'https://exam.university.edu/*',
      'https://cdn.university.edu/*',
      'https://auth.sso.edu/oauth2/*',
    ],
  };

  const guard = new NavigationGuard(config);

  // 1. Same origin / start URL allowed
  const startDec = guard.evaluateNavigation('https://exam.university.edu/login');
  console.assert(startDec.allowed === true, 'Test 1.1 Failed: Start URL should be allowed');

  const subpathDec = guard.evaluateNavigation('https://exam.university.edu/questions/section-1');
  console.assert(subpathDec.allowed === true, 'Test 1.2 Failed: Subpath under start URL should be allowed');
  console.log('✔ Test 1: Navigation within start URL origin permitted');

  // 2. Matching allowedUrls patterns
  const cdnDec = guard.evaluateNavigation('https://cdn.university.edu/assets/style.css');
  console.assert(cdnDec.allowed === true, 'Test 2.1 Failed: CDN URL matching wildcard should be allowed');

  const ssoDec = guard.evaluateNavigation('https://auth.sso.edu/oauth2/authorize?client_id=123');
  console.assert(ssoDec.allowed === true, 'Test 2.2 Failed: SSO URL matching pattern should be allowed');
  console.log('✔ Test 2: Navigation to allowed external exam resources permitted');

  // 3. Block unapproved external navigation
  const externalDec = guard.evaluateNavigation('https://google.com/search?q=exam+answers');
  console.assert(externalDec.allowed === false, 'Test 3.1 Failed: External Google navigation must be blocked');

  const socialDec = guard.evaluateNavigation('https://discord.com/app');
  console.assert(socialDec.allowed === false, 'Test 3.2 Failed: Social site navigation must be blocked');
  console.log('✔ Test 3: Unapproved external URLs strictly blocked');

  // 4. Block dangerous protocols
  const jsDec = guard.evaluateNavigation('javascript:alert(1)');
  console.assert(jsDec.allowed === false, 'Test 4.1 Failed: javascript: pseudo-protocol must be blocked');

  const dataDec = guard.evaluateNavigation('data:text/html,<h1>hacked</h1>');
  console.assert(dataDec.allowed === false, 'Test 4.2 Failed: data: URI must be blocked');
  console.log('✔ Test 4: Dangerous protocols blocked');

  // 5. Harmless internal scheme
  const blankDec = guard.evaluateNavigation('about:blank');
  console.assert(blankDec.allowed === true, 'Test 5.1 Failed: about:blank should be allowed');
  console.log('✔ Test 5: Harmless about:blank allowed');
}

