# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - img "background"
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]: Sign up
      - generic [ref=e8]: Create a new account
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Email
          - textbox "Email" [ref=e14]
        - generic [ref=e15]:
          - generic [ref=e17]: Password
          - textbox "Password" [ref=e18]
        - generic [ref=e19]:
          - generic [ref=e21]: Repeat Password
          - textbox "Repeat Password" [ref=e22]
        - button "Sign up" [ref=e23] [cursor=pointer]
      - generic [ref=e28]: Or continue with
      - button "Sign up with Google" [ref=e29] [cursor=pointer]: Continue with Google
      - generic [ref=e30]:
        - text: Already have an account?
        - link "Login" [ref=e31] [cursor=pointer]:
          - /url: /auth/login
  - button "Open Next.js Dev Tools" [ref=e37] [cursor=pointer]:
    - img [ref=e38] [cursor=pointer]
  - alert [ref=e41]
```