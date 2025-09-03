-- Migration 011: Onboarding Question Bank Seed Data
-- Seeds the question bank with Stage 1 (behavioral probes), Stage 2 (contextual), and Stage 3 (somatic/belief)

-- Stage 1: Core Behavioral Probes (Fixed set for all users)
insert into public.onboarding_questions (id, stage, type, prompt, helper, options, order_hint) values
('S1_Q1', 1, 'single_choice', 'You''re about to share important work publicly. What happens inside you?', 'There''s no right answer—just notice what feels most true.', 
  '[
    {"value":"surge_energy","label":"A surge of energy—this is where I come alive"},
    {"value":"methodical_checking","label":"Methodical checking of every detail"},
    {"value":"wondering_reception","label":"Wondering how it will land with people"},
    {"value":"noticing_improvement","label":"Noticing what could still be better"}
  ]', 1),

('S1_Q2', 1, 'single_choice', 'Plans suddenly changed. Your immediate response?', 'Trust your first instinct.', 
  '[
    {"value":"energized_possibilities","label":"Feel energized by the new possibilities"},
    {"value":"protect_secure","label":"Quickly identify what needs protecting or secured"},
    {"value":"check_affected","label":"Check who might be affected by the change"},
    {"value":"analyze_wrong","label":"Analyze what went wrong with the original plan"}
  ]', 2),

('S1_Q3', 1, 'single_choice', 'Someone seems upset with you but hasn''t said why. You:', 'Notice what your system wants to do first.', 
  '[
    {"value":"give_space","label":"Give them space to process their feelings on their own"},
    {"value":"directly_ask","label":"Directly ask them what''s happening for them"},
    {"value":"review_actions","label":"Review what you might have done to cause it"},
    {"value":"focus_elsewhere","label":"Focus on something else entirely to get your mind off it"}
  ]', 3),

('S1_Q4', 1, 'single_choice', 'You''ve finished something significant. Your first thought is?', 'What comes up immediately?', 
  '[
    {"value":"whats_next","label":"Already thinking about what''s next on the list"},
    {"value":"ensure_perfect","label":"Ensuring nothing was missed and all details are perfect"},
    {"value":"who_share","label":"Who can I share this with?"},
    {"value":"could_be_better","label":"What could have been done better?"}
  ]', 4),

('S1_Q5', 1, 'single_choice', 'A wave of sadness appears, seemingly from nowhere. Your instinct is to:', 'What''s your automatic response?', 
  '[
    {"value":"push_down_busy","label":"Push it down and get busy with a task or distraction"},
    {"value":"analyze_logical","label":"Try to analyze it and figure out the logical reason you''re feeling this way"},
    {"value":"let_feel","label":"Let yourself feel it, maybe getting quiet or listening to music that matches the mood"},
    {"value":"judge_emotional","label":"Judge yourself for being \"too emotional\" or \"negative\""}
  ]', 5);

-- Stage 2: Contextual Refinement Question Bank (12 total - 4 will be selected dynamically)
insert into public.onboarding_questions (id, stage, type, prompt, helper, options, order_hint, theme_weights) values

-- Achievement/Striving patterns
('S2_Q1', 2, 'single_choice', 'When you push yourself hard, it''s usually because:', 'What drives the intensity?', 
  '[
    {"value":"love_challenge","label":"I genuinely love the challenge and the feeling of growth"},
    {"value":"prove_worth","label":"I feel a need to prove my worth to myself or others"},
    {"value":"others_counting","label":"I believe that others are counting on me to deliver"},
    {"value":"intolerance_mediocrity","label":"I have a deep intolerance for mediocrity or falling short"}
  ]', 1, '{"achievement":0.8,"perfectionism":0.4,"self_criticism":0.3}'),

-- Perfectionism/Self-Criticism patterns  
('S2_Q2', 2, 'single_choice', 'That inner voice that tells you "it''s not good enough yet" is trying to:', 'What''s its intention?', 
  '[
    {"value":"protect_judgment","label":"Protect you from being judged or rejected by others"},
    {"value":"prevent_complacency","label":"Keep you from getting complacent or lazy"},
    {"value":"fullest_potential","label":"Make sure you live up to your absolute fullest potential"},
    {"value":"prevent_catastrophe","label":"Prevent a catastrophic mistake or failure from happening"}
  ]', 2, '{"perfectionism":0.9,"self_criticism":0.7,"safety":0.4}'),

-- Relational/People-Pleasing patterns
('S2_Q3', 2, 'single_choice', 'When you focus on the needs of others, it''s often driven by a desire to:', 'What''s underneath the focus on others?', 
  '[
    {"value":"genuine_harmony","label":"Create genuine harmony and connection in the group"},
    {"value":"everyone_included","label":"Make sure everyone feels seen and included"},
    {"value":"avoid_conflict","label":"Avoid conflict or disapproval at all costs"},
    {"value":"feel_needed","label":"Feel needed and valuable to the people around you"}
  ]', 3, '{"relational":0.8,"conflict_avoidance":0.6,"caretaking":0.5}'),

-- Safety/Control/Risk-Aversion patterns
('S2_Q4', 2, 'single_choice', 'When you''re planning for risks, you''re primarily:', 'What are you protecting?', 
  '[
    {"value":"protect_pain","label":"Protecting yourself from future pain or disappointment"},
    {"value":"protect_others","label":"Ensuring that your actions don''t negatively affect others"},
    {"value":"maintain_control","label":"Maintaining a sense of order and control over the situation"},
    {"value":"prevent_embarrassment","label":"Preventing the possibility of failure or embarrassment"}
  ]', 4, '{"safety":0.9,"control":0.7,"anxiety":0.4}'),

-- Avoidance/Distraction patterns
('S2_Q5', 2, 'single_choice', 'The ''part'' of you that distracts you or makes you procrastinate is often trying to:', 'What''s it protecting you from?', 
  '[
    {"value":"needed_break","label":"Give you a much-needed break from constant pressure"},
    {"value":"avoid_threatening","label":"Keep you away from a feeling that seems threatening or overwhelming"},
    {"value":"rebel_expectations","label":"Rebel against the rules or expectations being placed on you"},
    {"value":"conserve_energy","label":"Conserve energy because the task ahead feels too big to face"}
  ]', 5, '{"avoidance":0.9,"overwhelm":0.6,"restlessness":0.3}'),

-- Support/Independence patterns
('S2_Q6', 2, 'single_choice', 'When someone offers you genuine, unconditional support, your first internal reaction is often:', 'What comes up automatically?', 
  '[
    {"value":"relief","label":"Relief. Finally, I can let my guard down"},
    {"value":"suspicion","label":"Suspicion. What do they really want from me?"},
    {"value":"discomfort_burden","label":"Discomfort. I don''t want to be a burden to them"},
    {"value":"urge_repay","label":"Gratitude, but with an immediate urge to \"repay\" the kindness"}
  ]', 6, '{"independence":0.7,"safety":0.5,"relational":0.4}'),

-- Emotional Overwhelm patterns
('S2_Q7', 2, 'single_choice', 'When emotions feel too big or overwhelming, the part that steps in usually tries to:', 'How do you handle intensity?', 
  '[
    {"value":"analyze_rationalize","label":"Analyze and rationalize the feelings away"},
    {"value":"numb_shutdown","label":"Numb or shut down the emotional experience entirely"},
    {"value":"express_anger","label":"Express the intensity through anger or frustration"},
    {"value":"seek_comfort","label":"Seek comfort or soothing from others or substances"}
  ]', 7, '{"overwhelm":0.8,"criticism":0.4,"avoidance":0.5}'),

-- Hyper-Independence patterns
('S2_Q8', 2, 'single_choice', 'Your tendency to ''do everything yourself'' often comes from:', 'What drives the self-reliance?', 
  '[
    {"value":"dont_trust_others","label":"Not trusting others to do things correctly or completely"},
    {"value":"avoid_vulnerability","label":"Wanting to avoid owing anyone anything or being vulnerable"},
    {"value":"only_understand","label":"Believing you''re the only one who truly understands what needs to be done"},
    {"value":"fear_weakness","label":"Fear that asking for help reveals weakness or inadequacy"}
  ]', 8, '{"independence":0.9,"perfectionism":0.5,"safety":0.4}'),

-- Inner Critic patterns
('S2_Q9', 2, 'single_choice', 'When you notice yourself being self-critical, that voice is usually:', 'What''s the critic trying to do?', 
  '[
    {"value":"motivate_better","label":"Trying to motivate you to do better next time"},
    {"value":"protect_judgment","label":"Protecting you from others'' judgment by getting there first"},
    {"value":"express_disappointment","label":"Expressing disappointment that you didn''t live up to your standards"},
    {"value":"punish_failure","label":"Punishing you for a perceived failure or mistake"}
  ]', 9, '{"self_criticism":0.9,"perfectionism":0.6,"shame":0.4}'),

-- Caretaking patterns
('S2_Q10', 2, 'single_choice', 'When you feel compelled to fix someone else''s problem, you''re often driven by:', 'What motivates the rescuing?', 
  '[
    {"value":"genuine_empathy","label":"Genuine empathy and desire to reduce their suffering"},
    {"value":"discomfort_pain","label":"Discomfort with witnessing someone else''s pain"},
    {"value":"responsible_wellbeing","label":"A sense that you''re responsible for others'' wellbeing"},
    {"value":"feel_useful","label":"Wanting to feel useful and needed by others"}
  ]', 10, '{"caretaking":0.8,"relational":0.6,"control":0.3}'),

-- Restlessness patterns
('S2_Q11', 2, 'single_choice', 'The part of you that always needs to be productive or busy is trying to:', 'What drives the constant doing?', 
  '[
    {"value":"prove_worth","label":"Prove your worth through constant achievement"},
    {"value":"avoid_feelings","label":"Avoid uncomfortable feelings that arise in stillness"},
    {"value":"stay_ahead","label":"Stay ahead of potential problems or responsibilities"},
    {"value":"feel_control","label":"Feel in control of your time and circumstances"}
  ]', 11, '{"restlessness":0.8,"achievement":0.4,"avoidance":0.5}'),

-- Conflict Avoidance patterns
('S2_Q12', 2, 'single_choice', 'When tension arises in relationships, your instinct to smooth things over usually aims to:', 'What are you protecting by peacekeeping?', 
  '[
    {"value":"preserve_connection","label":"Preserve the connection and prevent abandonment"},
    {"value":"maintain_image","label":"Maintain your image as the \"good\" or \"easy\" person"},
    {"value":"avoid_discomfort","label":"Avoid the discomfort of witnessing others'' distress"},
    {"value":"keep_safe","label":"Keep everyone safe from potentially hurtful emotions"}
  ]', 12, '{"conflict_avoidance":0.9,"relational":0.6,"safety":0.4}');

-- Stage 3: Somatic & Belief Mapping (Fixed set for all users)
insert into public.onboarding_questions (id, stage, type, prompt, helper, options, order_hint) values

('S3_Q1', 3, 'multi_select', 'Where do you typically feel stress or tension in your body?', 'Select all that apply—bodies hold information.', 
  '[
    {"value":"chest","label":"Chest (tightness, pressure)"},
    {"value":"shoulders_neck","label":"Shoulders/Neck (tension, knots)"},
    {"value":"stomach","label":"Stomach (churning, knots, acidity)"},
    {"value":"head","label":"Head (pressure, fog, headache)"},
    {"value":"nowhere","label":"Nowhere specific / I don''t notice it in my body"}
  ]', 1),

('S3_Q2', 3, 'free_text', 'Complete this sentence: "I absolutely must..."', 'What feels non-negotiable to you? A few words are enough.', '[]', 2),

('S3_Q3', 3, 'free_text', 'What is your first thought when you realize you''ve made a mistake?', 'The very first thing that goes through your mind.', '[]', 3),

('S3_Q4', 3, 'single_choice', 'Which feeling do you trust the least?', 'Which one feels most unreliable or dangerous?', 
  '[
    {"value":"anger","label":"Anger"},
    {"value":"sadness","label":"Sadness"},
    {"value":"joy","label":"Joy"},
    {"value":"fear","label":"Fear"},
    {"value":"contentment","label":"Contentment"}
  ]', 4);
