import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
})

function SampleNewsletter() {
  return (
    <div className="origin-top-left text-[10pt] leading-[1.35] text-[#1a1a1a] flex flex-col" style={{ fontFamily: "Georgia, 'Times New Roman', serif", width: '7.5in', height: '10in', padding: '0.3in 0.35in' }}>
      {/* Masthead */}
      <div className="border-b-[3px] border-double border-[#333] pb-1.5 mb-2 text-center">
        <div className="text-[14pt] tracking-[6px]">🧻💩📰</div>
        <div className={`${playfair.className} text-[26pt] font-black tracking-[2px] my-0.5`}>The Poopin&apos; Papers</div>
        <div className="italic text-[10pt] text-[#555]">The Only Newspaper Worth Sitting Down For</div>
        <div className="text-[8pt] text-[#777] mt-0.5">Vol. 1, No. 12 — Week of March 16, 2026 — Est. 2026</div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-2 flex-1" style={{ gridTemplateRows: 'auto auto auto 1fr' }}>
        {/* This Week */}
        <div className="border-2 border-[#333] rounded-md p-2.5">
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">📅 This Week</div>
          <div className="space-y-1.5 text-[9.5pt]">
            <p>🎒 <strong>Spring break starts Friday!</strong> Time to unplug, recharge, and sleep past 7am.</p>
            <p>🌮 <strong>Taco Tuesday</strong> — everyone picks a topping. No, ketchup doesn&apos;t count.</p>
            <p>🏊 <strong>Swim practice</strong> moves to 4pm this week. Don&apos;t forget your goggles.</p>
            <p>🎂 <strong>Grandma&apos;s birthday</strong> is Saturday! Card-making station opens Thursday.</p>
          </div>
        </div>

        {/* Chores */}
        <div className="border-2 border-[#333] rounded-md p-2.5" style={{ background: '#f9f9f4' }}>
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">✅ Weekly Chore Check</div>
          <div className="italic text-[8.5pt] text-[#666] mb-1.5">Check &apos;em off as you go!</div>
          <div className="space-y-1.5">
            {['Make your bed every morning', 'Feed the dog before school', 'Put dishes in the dishwasher', 'Take out recycling', 'Wipe down the bathroom sink'].map(chore => (
              <div key={chore} className="flex items-center justify-between border-b border-dotted border-[#ccc] pb-1 text-[9.5pt]">
                <span>{chore}</span>
                <span className="inline-block w-[13px] h-[13px] border-2 border-[#333] rounded-sm shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Meal Plan */}
        <div className="col-span-2 border-2 border-[#333] rounded-md p-2.5" style={{ background: '#faf8f0' }}>
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">🍽️ Meal Plan</div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {[
              { day: 'Mon', meal: 'Spaghetti & meatballs' },
              { day: 'Tue', meal: 'Tacos (build your own!)' },
              { day: 'Wed', meal: 'Chicken stir fry' },
              { day: 'Thu', meal: 'Pizza night 🍕' },
              { day: 'Fri', meal: 'Mac & cheese' },
              { day: 'Sat', meal: 'Grilled burgers' },
              { day: 'Sun', meal: 'Soup & sandwiches' },
            ].map(d => (
              <div key={d.day} className="border border-[#ddd] rounded p-1">
                <div className="font-bold text-[9pt] border-b border-[#eee] pb-0.5 mb-0.5">{d.day}</div>
                <div className="text-[7.5pt] text-[#444] leading-tight">{d.meal}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coaching */}
        <div className="col-span-2 border-2 border-[#333] rounded-md p-2.5" style={{ background: '#f5f5f0' }}>
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">💪 Coaching Corner</div>
          <div className="text-center">
            <div className={`${playfair.className} font-bold italic text-[14pt] mb-1`}>The Magic Word Isn&apos;t &ldquo;Please&rdquo;</div>
            <p className="text-[10pt] text-[#444] max-w-[90%] mx-auto leading-relaxed">
              It&apos;s &ldquo;yet.&rdquo; When your kid says &ldquo;I can&apos;t do this,&rdquo; add &ldquo;yet&rdquo; to the end.
              One tiny word turns frustration into possibility. &ldquo;I can&apos;t do long division&rdquo; becomes
              &ldquo;I can&apos;t do long division <em>yet</em>.&rdquo; Try it this week — it works on grown-ups too.
            </p>
          </div>
        </div>

        {/* Fun Zone */}
        <div className="border-2 border-[#333] rounded-md p-2.5" style={{ background: '#fafaf5' }}>
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">🎉 The Fun Zone</div>
          <div className="space-y-1.5 text-[9.5pt]">
            <div>
              <p className="italic">Why did the scarecrow win an award?</p>
              <p className="font-bold">He was outstanding in his field!</p>
            </div>
            <div className="border-t border-dashed border-[#ccc] pt-1.5" />
            <div>
              <p className="italic">What do you call a fake noodle?</p>
              <p className="font-bold">An impasta!</p>
            </div>
            <div className="border-t border-dashed border-[#ccc] pt-1.5" />
            <div>
              <p className="italic">Why don&apos;t eggs tell jokes?</p>
              <p className="font-bold">They&apos;d crack each other up!</p>
            </div>
          </div>
        </div>

        {/* Brain Fuel */}
        <div className="border-2 border-[#333] rounded-md p-2.5">
          <div className="text-[10pt] font-bold uppercase tracking-[1.5px] border-b-2 border-[#ccc] pb-1 mb-1.5">🧠 Brain Fuel</div>
          <div className="border-l-[4px] border-[#333] bg-[#f0efe8] p-2.5 text-[11pt] italic mb-2 leading-relaxed">
            &ldquo;Be yourself; everyone else is already taken.&rdquo;
            <div className="text-[8pt] text-[#666] not-italic mt-1">— Oscar Wilde</div>
          </div>
          <p className="text-[9.5pt]"><strong>Brain Teaser:</strong> I have cities but no houses, mountains but no trees, and water but no fish. What am I?</p>
          <p className="text-[8pt] text-[#999] italic mt-1.5">(Answer upside down on the fridge)</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-[3px] border-double border-[#333] mt-2 pt-1.5 text-center italic text-[8pt] text-[#888]">
        Lovingly assembled for the Davis household &middot; Printed fresh every week &middot; Please recycle (or compost)
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: '#faf8f3' }}>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          {/* Tiny emoji flourish */}
          <div className="mb-4 text-2xl tracking-[8px] opacity-80">🧻 💩 📰</div>

          <h1 className={`${playfair.className} text-6xl font-black text-stone-900 tracking-tight sm:text-7xl lg:text-8xl`}>
            The Poopin&apos; Papers
          </h1>

          <p className={`${playfair.className} mt-3 text-xl italic text-stone-500 sm:text-2xl`}>
            The Only Newspaper Worth Sitting Down For
          </p>

          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
            A weekly family newspaper with meal plans, chores, jokes your kids will groan at,
            and just enough chaos to keep everyone on the same page. Literally.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-stone-900 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-stone-800 hover:shadow-xl hover:-translate-y-0.5"
            >
              Start Your First Issue
            </Link>
            <span className="text-sm text-stone-400">$5/mo &middot; Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ===== DIVIDER ===== */}
      <div className="mx-auto max-w-xs border-t-[3px] border-double border-stone-300" />

      {/* ===== NEWSLETTER PREVIEW ===== */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className={`${playfair.className} mb-4 text-center text-3xl font-bold text-stone-800 sm:text-4xl`}>
          This is what Sunday morning looks like.
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-stone-500">
          Every week, a fresh issue lands in your inbox. Print it out, hang it on the fridge,
          or leave it where it&apos;ll actually get read.
        </p>

        {/* Newspaper frame */}
        <div className="relative mx-auto" style={{ maxWidth: '420px' }}>
          {/* Shadow / paper effect */}
          <div
            className="overflow-hidden rounded-sm border border-stone-200 bg-white shadow-2xl"
            style={{
              transform: 'rotate(-1.5deg)',
              boxShadow: '8px 12px 40px rgba(0,0,0,0.12), 2px 4px 12px rgba(0,0,0,0.06)',
              aspectRatio: '8.5 / 11',
            }}
          >
            <div style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: `${100 / 0.55}%` }}>
              <SampleNewsletter />
            </div>
          </div>
          {/* Decorative pin */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-400 border-2 border-red-500 shadow-md z-10" />
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section style={{ background: '#f3f1ea' }}>
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className={`${playfair.className} mb-14 text-center text-3xl font-bold text-stone-800 sm:text-4xl`}>
            Three steps. Zero effort.
          </h2>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                num: '01',
                title: 'Tell us about your crew',
                desc: 'Names, ages, who refuses to eat vegetables. The important stuff.',
              },
              {
                num: '02',
                title: 'Your paper shows up',
                desc: 'Every Sunday, a fresh issue hits your inbox. Personalized, printable, ready to go.',
              },
              {
                num: '03',
                title: 'Print it. Post it. Read it.',
                desc: 'On the fridge. On the coffee table. You know where.',
              },
            ].map((step) => (
              <div key={step.num} className="text-center md:text-left">
                <div className={`${playfair.className} text-5xl font-black text-stone-200`}>
                  {step.num}
                </div>
                <h3 className="mt-2 text-lg font-bold text-stone-800">{step.title}</h3>
                <p className="mt-2 text-stone-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className={`${playfair.className} mb-4 text-center text-3xl font-bold text-stone-800 sm:text-4xl`}>
          Everything your family needs. Nothing it doesn&apos;t.
        </h2>
        <p className="mx-auto mb-14 max-w-md text-center text-stone-500">
          Each issue is packed with the stuff that actually keeps a household running.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              emoji: '🍽️',
              title: 'Meal Plans',
              desc: "What's for dinner? Actually answered, for once.",
            },
            {
              emoji: '🧹',
              title: 'Chores',
              desc: 'Assigned, checkboxed, no excuses accepted.',
            },
            {
              emoji: '💪',
              title: 'Coaching Corner',
              desc: 'Parenting wisdom without the judgment.',
            },
            {
              emoji: '🎉',
              title: 'Fun Zone',
              desc: 'Jokes bad enough to make a dad proud.',
            },
            {
              emoji: '🧠',
              title: 'Brain Fuel',
              desc: 'Quotes and riddles that spark actual conversations.',
            },
            {
              emoji: '✨',
              title: 'Custom Section',
              desc: 'Bible verses, family goals, whatever you want. Make it yours.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 text-3xl">{feature.emoji}</div>
              <h3 className="mb-1 text-lg font-bold text-stone-800">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-stone-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== PRICING + FINAL CTA ===== */}
      <section style={{ background: '#f3f1ea' }}>
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <h2 className={`${playfair.className} mb-8 text-3xl font-bold text-stone-800 sm:text-4xl`}>
            Less than a coffee. More than a newsletter.
          </h2>

          <div className="rounded-xl border-2 border-stone-300 bg-white p-8 shadow-lg">
            <div className={`${playfair.className} text-5xl font-black text-stone-900`}>$5</div>
            <div className="text-stone-500 text-sm mb-6">per month</div>

            <ul className="mb-8 space-y-3 text-left text-stone-600">
              {[
                'A fresh family newspaper, every single week',
                'Customized to your household',
                'Printable PDF delivered to your inbox',
                'Cancel anytime — no hard feelings',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 text-stone-800 font-bold">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full rounded-full bg-stone-900 px-6 py-3 text-center font-semibold text-white shadow-md transition-all hover:bg-stone-800 hover:shadow-lg hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-stone-200 py-8 text-center" style={{ background: '#faf8f3' }}>
        <p className={`${playfair.className} text-stone-400 italic`}>
          Poopin&apos; Papers &middot; Est. 2026
        </p>
      </footer>
    </div>
  )
}
