'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import Link from 'next/link'

export const FAQ = () => {
  const Questions = [
    {
      key: 'question1',
      question: 'Does LeadMap provide comprehensive property and ownership data?',
      answer:
        'Yes, LeadMap offers one of the largest and most accurate real estate databases, with verified property records, owner information, and comprehensive market data to help you find and qualify leads faster.',
    },
    {
      key: 'question2',
      question: 'Can LeadMap enable precise lead targeting via advanced filtering?',
      answer:
        'Absolutely. LeadMap provides powerful filtering options including property type, location, price range, ownership details, and market indicators to help you target exactly the leads you need.',
    },
    {
      key: 'question3',
      question: 'Does LeadMap automate outreach sequences and follow-ups?',
      answer:
        'Yes, LeadMap includes automated workflow tools that can schedule follow-ups, send outreach sequences, and help you stay on top of every opportunity without manual effort.',
    },
    {
      key: 'question4',
      question: 'Does LeadMap integrate smoothly with CRMs and existing real estate tools?',
      answer:
        'LeadMap offers seamless integrations with popular CRMs and real estate platforms, allowing you to sync your leads and data across your entire workflow.',
    },
    {
      key: 'question5',
      question: 'Does LeadMap offer analytics and reporting on lead generation performance?',
      answer:
        'Yes, LeadMap provides comprehensive analytics and reporting features to track your lead generation, conversion rates, and overall performance metrics.',
    },
    {
      key: 'question6',
      question: 'Is LeadMap good value for its cost, especially for growing real estate teams?',
      answer:
        'LeadMap offers flexible pricing plans designed to scale with your business. Many teams see ROI within weeks through increased deal volume and reduced prospecting time.',
    },
    {
      key: 'question7',
      question: 'Can LeadMap help reduce time spent on manual prospecting?',
      answer:
        "Absolutely. LeadMap's AI-powered tools automate many manual prospecting tasks, helping agents save hours each week while finding higher-quality leads.",
    },
    {
      key: 'question8',
      question: 'Does LeadMap improve the quality of sales pipelines?',
      answer:
        'Yes, LeadMap helps you focus on high-intent, qualified leads by providing rich property and owner data, allowing you to build more valuable and actionable pipelines.',
    },
  ]
  return (
    <section>
      <div className="max-w-[800px] mx-auto px-4 lg:pb-24 pb-20 pt-0">
        <h3 className="text-2xl sm:text-3xl md:text-40 font-bold text-link dark:text-white leading-tight text-center mb-10 sm:mb-14">
          Frequently asked questions
        </h3>
        <Accordion type="single" collapsible className="flex flex-col">
          {Questions.map((item) => (
            <AccordionItem key={item.key} value={item.key}>
              <AccordionTrigger className="px-6 text-lg py-5 rounded-md">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="px-6 py-5 text-base opacity-80 leading-7 rounded-b-md">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-14 w-fit mx-auto py-1 px-2 rounded-md border-2 border-dashed border-border dark:border-darkborder text-sm font-medium justify-center text-lightmuted dark:text-darklink flex items-center flex-wrap gap-1">
          Still have a question ?
          <Link href="/contact" className="underline hover:text-primary">
            Contact us
          </Link>
        </p>
      </div>
    </section>
  )
}
