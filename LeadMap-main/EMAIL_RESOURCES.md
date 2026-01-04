# Email Resources - Open Source Tools & Libraries

> **Note**: This document is integrated from the [awesome-opensource-email](https://github.com/Mindbaz/awesome-opensource-email) curated list. It provides a comprehensive reference of open-source email tools, servers, frameworks, and libraries that can be useful when working on LeadMap's email marketing system.

## Table of Contents

- [Sending](#sending)
  - [SMTP Server](#smtp-server)
  - [Email Testing Application](#email-testing-application)
  - [IMAP/POP Server](#imappop-server)
  - [JMAP Server & Others](#jmap-server--others)
  - [Complete Email Server](#complete-email-server)
  - [SPAM Filtering](#spam-filtering)
  - [Inbox API](#inbox-api)
  - [Forwarding](#forwarding)
  - [SMTP Testing](#smtp-testing)
  - [Inbound](#inbound)
- [Deliverability](#deliverability)
  - [Email Verification](#email-verification)
  - [Reputation](#reputation)
- [Email Platform](#email-platform)
  - [Marketing Platform](#marketing-platform)
  - [Newsletter Platform](#newsletter-platform)
  - [Email API](#email-api)
- [Code](#code)
  - [Framework](#framework)
  - [Templating](#templating)
  - [Library](#library)
  - [Other](#other)
- [Editing](#editing)
  - [Email Builder & Visual Editing Component](#email-builder--visual-editing-component)
- [Email Solution](#email-solution)
  - [Groupware / Webmail](#groupware--webmail)
  - [CLI](#cli)
- [Security](#security)
  - [Security Check](#security-check)
  - [DMARC](#dmarc)
  - [Privacy](#privacy)
- [Disposable Emails Domain List](#disposable-emails-domain-list)
- [Other](#other-1)

---

## Sending

### SMTP Server

* **[Postfix](https://www.postfix.org/)** - The most famous email server - `IPL-1.0`, `C`
* **[KumoMTA](https://www.kumomta.com/)** - The first Open-Source high-performance MTA developed from the ground-up for high-volume email sending environments. - `Rust`, `Lua`
* **[Haraka](https://haraka.github.io/haraka/)** - A modern, high performance, flexible SMTP server - `Nodejs`
* **[Zone-MTA](https://github.com/zone-eu/zone-mta)** - Modern outbound MTA cross platform and extendable server application - `Nodejs`
* **[Postal](https://github.com/postalserver/postal)** - A fully featured open source mail delivery platform for incoming & outgoing e-mail
* **[Maddy](https://maddy.email/)** - Composable all-in-one mail server - `GPLv3`, `Go`
* **[Chasquid](https://blitiri.com.ar/p/chasquid/)** - SMTP (email) server with a focus on simplicity, security, and ease of operation - `Ruby`
* **[MailWhale](https://github.com/mailwhale/mailwhale)** - A bring-your-own-SMTP-server mail relay with REST API and web UI
* **[Cuttlefish](https://cuttlefish.io/)** - Transactional email server with a lovely web interface - `AGPLv3`, `Ruby`
* **[DragonFly](http://www.libdragonfly.org/)** - A small MTA for home and office use - `Linux`, `UNIX`, `BSD`, `C`
* **[hMailServer](https://www.hmailserver.com/)** - A user friendly IMAP, SMTP and POP3 server with admin GUI and spam protection. - `Windows`, `AGPLv3`, `C++`
* **[EmailRelay](https://emailrelay.sourceforge.io/)** - A small SMTP and POP3 server that is easy to configure - `Windows`, `Linux`, `OpenWrt`, `GPLv3`, `C++`
* **[SMTPRelay](https://github.com/decke/smtprelay)** - Simple Golang SMTP relay/proxy server - `MIT`, `Go`
* **[James](https://james.apache.org/)** - James stands for Java Apache Mail Enterprise Server! - `Apache License Version 2.0`, `Java`

### Email Testing Application

* **[Blackhole](https://github.com/mikeabrahamsen/Blackhole)** - Blackhole is an MTA written on top of asyncio, utilising async and await statements that dumps all mail it receives to /dev/null.
* **[SMTP4dev](https://github.com/rnwood/smtp4dev)** - the fake smtp email server for development and testing
* **[MailHog](https://github.com/mailhog/MailHog)** - Email testing for developers
* **[MailCatcher](https://mailcatcher.me/)** - Catches mail and serves it through a web interface
* **[MailDev](https://github.com/maildev/maildev)** - Simple way to test your application's generated email
* **[MailSlurper](https://mailslurper.com/)** - A small SMTP mail server perfect for development
* **[Mailtrap](https://mailtrap.io/)** - Email testing service (Note: Not fully open source, but useful for testing)
* **[Mailpit](https://github.com/axllent/mailpit)** - An email and SMTP testing tool with API for developers
* **[Mailosaur](https://mailosaur.com/)** - Email testing service (Note: Not fully open source, but useful for testing)
* **[FakeSMTP](https://nilhcem.github.io/FakeSMTP/)** - Fake SMTP server with GUI for testing emails in applications
* **[GreenMail](https://greenmail-mail-test.github.io/greenmail/)** - Open source, lightweight, sandboxed suite of email servers (SMTP, POP3, IMAP)

### IMAP/POP Server

* **[Dovecot](https://www.dovecot.org/)** - IMAP and POP3 server
* **[Cyrus IMAP](https://www.cyrusimap.org/)** - IMAP, POP3, and JMAP server
* **[Courier](https://www.courier-mta.org/)** - Mail server with IMAP and POP3 support

### JMAP Server & Others

* **[Stalwart JMAP](https://stalw.art/jmap)** - High-performance JMAP server implementation
* **[Cyrus JMAP](https://www.cyrusimap.org/jmap/)** - JMAP implementation in Cyrus IMAP

### Complete Email Server

* **[Mailcow](https://mailcow.github.io/mailcow-dockerized-docs/)** - The mailserver suite with the 'moo' – 🐮 + 🐋 = 💕
* **[Mail-in-a-Box](https://mailinabox.email/)** - Easy to deploy mail server in a box
* **[iRedMail](https://www.iredmail.org/)** - Open source mail server solution
* **[Modoboa](https://modoboa.org/en/)** - Mail hosting and management platform

### SPAM Filtering

* **[Rspamd](https://rspamd.com/)** - Fast, free and open-source spam filtering system
* **[SpamAssassin](https://spamassassin.apache.org/)** - Mail filter to identify spam
* **[DSpam](https://dspam.sourceforge.net/)** - Statistical spam filter

### Inbox API

* **[Nylas](https://www.nylas.com/)** - Email, calendar, and contacts API (Note: Commercial with open-source components)
* **[Mailgun](https://www.mailgun.com/)** - Email API service (Note: Commercial with open-source components)

### Forwarding

* **[Forward Email](https://forwardemail.net/)** - Open-source email forwarding service

### SMTP Testing

* **[SMTP Tester](https://github.com/joehillen/sysz)** - SMTP testing utilities

### Inbound

* **[InboxSDK](https://www.inboxsdk.com/)** - JavaScript SDK for building email extensions (Note: Commercial)

---

## Deliverability

### Email Verification

* **[EmailVerifier](https://github.com/AfterShip/email-verifier)** - Email verification library
* **[Trumail](https://github.com/sdwolfe32/trumail)** - Free and Open Source Email Validation API

### Reputation

* **[Sender Score](https://www.senderscore.org/)** - Email reputation monitoring (Note: Commercial service)

---

## Email Platform

### Marketing Platform

* **[Mailtrain](https://mailtrain.org/)** - Self hosted newsletter application built on Node.js
* **[Listmonk](https://listmonk.app/)** - Self-hosted newsletter and mailing list manager
* **[Sendy](https://sendy.co/)** - Self-hosted email newsletter application (Note: Commercial)

### Newsletter Platform

* **[Ghost](https://ghost.org/)** - Professional publishing platform with email newsletters
* **[Buttondown](https://buttondown.email/)** - Email newsletter service (Note: Commercial with open-source components)

### Email API

* **[Hyvor Relay](https://github.com/hyvor/relay)** - Open-Source Email API for Developers. Self-hosted Alternative to SES, Mailgun, SendGrid. - `PHP`, `AGPL-3.0`
* **[Resend](https://resend.com/)** - Email API for developers (Note: Commercial with open-source SDKs)
* **[Postmark](https://postmarkapp.com/)** - Transactional email API (Note: Commercial)

---

## Code

### Framework

* **[MailerQ](https://www.mailerq.com/)** - Enterprise mail queue manager (Note: Commercial with open-source components)
* **[Mailgun](https://www.mailgun.com/)** - Email service API (Note: Commercial)

### Templating

* **[MJML](https://mjml.io/)** - Framework that makes responsive email easy
* **[Foundation for Emails](https://get.foundation/emails.html)** - Quickly create responsive HTML emails
* **[Cerberus](https://www.cerberusemail.com/)** - A few simple, but solid patterns for responsive HTML email templates and newsletters
* **[HEML](https://heml.io/)** - HEML is an open source markup language for building responsive email
* **[Hermes](https://github.com/matcornic/hermes)** - Golang package that generates clean, responsive HTML e-mails for sending transactional mail
* **[Maud](https://maud.lambda.xyz/)** - Compile-time HTML templates for Rust - `MIT`, `Apache License`, `Rust`
* **[Foundation for Emails 2](https://get.foundation/emails.html)** - Quickly create responsive HTML emails that work on any device and client. Even Outlook. - `MIT`, `HTML`
* **[Inky](https://github.com/foundation/inky)** - Convert a simple HTML syntax into tables compatible with Foundation for Emails

### Library

* **[ballerina-email](https://central.ballerina.io/ballerinax/email)** - Easy to use, yet comprehensive library for sending mails with Ballerina - `Apache 2.0`, `Ballerina`
* **[go-smtp](https://github.com/emersion/go-smtp)** - An SMTP client & server library written in Go - `MIT`, `Go`
* **[go-mail](https://github.com/wneessen/go-mail)** - Easy to use, yet comprehensive library for sending mails with Go - `MIT`, `Go`
* **[go-msgauth](https://github.com/emersion/go-msgauth)** - 🔏 A Go library and tools for DKIM, DMARC and Authentication-Results - `MIT`, `Go`
* **[lettre](https://github.com/lettre/lettre)** - a mailer library for Rust - `MIT`, `Rust`
* **[mailparse](https://github.com/staktrace/mailparse)** - Rust library to parse mail files - `BSD Zero Clause`, `Rust`
* **[Nette Mail](https://github.com/nette/mail)** - Handy email creation and transfer library for PHP with both text and MIME-compliant support
* **[Stampie](https://github.com/Stampie/Stampie)** - Library for using online Email providers for PHP
* **[Play-Mailer](https://github.com/playframework/play-mailer)** - Play mailer plugin for Scala
* **[Sisimai](https://github.com/sisimai/sisimai)** - Mail Analyzing Interface: A library to parse RFC5322 bounce emails and generating structured data as JSON from parsed results. For Perl, Go & Ruby
* **[MailKit](https://github.com/jstedfast/MailKit)** - A cross-platform .NET library for IMAP, POP3, and SMTP
* **[MimeKit](https://github.com/jstedfast/MimeKit)** - A .NET MIME creation and parser library with support for S/MIME, PGP, DKIM, TNEF and Unix mbox spools
* **[Nodemailer](https://nodemailer.com/)** - A Node.js library
* **[PHPMailer](https://github.com/PHPMailer/PHPMailer)** - The classic email sending library for PHP
* **[Anymail](https://github.com/anymail/django-anymail)** - Django email backends and webhooks for multiple ESP - `BSD 3-Clause`, `Python`
* **[Swoosh](https://hexdocs.pm/swoosh/Swoosh.html)** - Compose, deliver and test your emails easily in Elixir - `MIT`, `Elixir`

### Other

* **[Can I email](https://www.caniemail.com/)** - Can I email… Support tables for HTML and CSS in emails
* **[Premail](https://github.com/premail/premail)** - Turns CSS blocks into style attributes `BSD 3-Clause`, `Python`
* **[HowToTarget.email](https://howtotarget.email/)** - How to target email clients for email development
* **[Email CSS Resets](https://github.com/mailgun/emailcss)** - List of email CSS normalise/resets
* **[Vue-Email](https://github.com/Dave136/vue-email)** - Write email templates with vue - `MIT`, `Typescript`

---

## Editing

### Email Builder & Visual Editing Component

* **[LePatron](https://github.com/LePatronEmail/lepatron)** - LePatron is an opensource email builder allowing to industrialize your email template production
* **[Mosaico](https://mosaico.io/)** - Responsive Email Template Editor
* **[React Email Editor](https://github.com/unlayer/react-email-editor)** - Drag-n-Drop Email Editor Component for React.js
* **[Vue Email Editor](https://github.com/unlayer/vue-email-editor)** - Drag-n-Drop Email Editor Component for Vue.js
* **[GrapesJS](https://grapesjs.com/)** - Free and Open source Web Builder Framework
* **[MySigMail Card](https://mysigmail.com/card/)** - An open source html email template builder with drag & drop editor
* **[Easy Email](https://github.com/m-Ryan/easy-email)** - DnD Email Editor based on React.js and MJML
* **[Paperbits emails](https://paperbits.io/)** - Paperbits editors and generators for email templates
* **[Drag-and-Drop-Email-Designer](https://github.com/mjmlio/drag-and-drop-email-designer)** - Drag and drop HTML email designer - `MIT`, `Typescript`
* **[email-builder-js](https://github.com/samuelnovaes/email-builder-js)** - A free and open-source block-based email template builder - `MIT`, `Typescript`
* **[email-builder-wysiwyg](https://github.com/JonnyBurger/email-builder-wysiwyg)** - A Resend Template-style WYSIWYG email editor with Notion-like editing that generates email-safe React Email templates. - `Typescript`
* **[maily.to](https://github.com/resendlabs/maily.to)** - Craft beautiful emails effortlessly with Maily, the powerful email editor that ensures impeccable communication across all major clients. - `MIT`, `Typescript`

---

## Email Solution

### Groupware / Webmail

* **[Bluemind](https://www.bluemind.net/)** - Collaborative messaging solution
* **[Roundcube](https://roundcube.net/)** - The Roundcube Webmail suite - `GPLv3`, `PHP`
* **[Tutanota](https://tutanota.com/)** - Tutanota is an email service with a strong focus on security and privacy
* **[Mailcow](https://mailcow.github.io/mailcow-dockerized-docs/)** - The mailserver suite with the 'moo' – 🐮 + 🐋 = 💕
* **[Cypht](https://cypht.org/)** - Cypht: Lightweight Open Source webmail written in PHP and JavaScript - `GNU Lesser General Public License v2.1`, `PHP`, `Javascript`
* **[Egroupware](https://www.egroupware.org/)** - Web based groupware server written in PHP - `GPLv2`, `PHP`

### CLI

* **[Himalaya](https://github.com/soywod/himalaya)** - CLI to manager email - `MIT`, `Rust`

---

## Security

### Security Check

* **[Trustymail](https://github.com/dhs-ncats/trustymail)** - Scan domains and return data based on trustworthy email best practices
* **[mailsec-check](https://github.com/fabacab/mailsec-check)** - Another utility to analyze state of deployment of security-related email protocols
* **[E-Mail Header Analyzer](https://github.com/mxtommy/EmailHeaderAnalyzer)** - E-Mail Header Analyzer
* **[Domain Security Scanner](https://github.com/domainaware/domain-security-scanner)** - Scan domains and receive advice based on their BIMI, DKIM, DMARC, and SPF records - `Apache License version 2.0`, `Go`
* **[Mailgoose](https://github.com/mailgoose/mailgoose)** - A web application that allows the users to check whether their SPF, DMARC and DKIM configuration is set up correctly. - `BSD 3-Clause "New" or "Revised" License`, `Python`
* **[mxcheck](https://github.com/trickest/mxcheck)** - mxcheck is an info and security scanner for e-mail servers. `GPL v-3`, `Go`
* **[Spamhaus-Intelligence-API-CLI](https://github.com/spamhaus/spamhaus-intelligence-api-cli)** - CLI to query Spamhaus Intelligence API `GPL v-3`, `Python`

### DMARC

* **[parsedmarc](https://github.com/domainaware/parsedmarc)** - A Python package and CLI for parsing aggregate and forensic DMARC reports - `Apache License version 2.0`, `Python`
* **[dmarc-report-converter](https://github.com/domainaware/dmarc-report-converter)** - Convert DMARC report files from xml to human-readable formats
* **[Open DMARC Analyzer](https://github.com/domainaware/opendmarc-analyzer)** - Open DMARC Analyzer is an Open Source DMARC Report Analyzer
* **[DmarcSrg](https://github.com/Proxmox/DmarcSrg)** - A php parser, viewer and summary report generator for incoming DMARC reports
* **[dmarcts-report-parser](https://github.com/techsneeze/dmarcts-report-parser)** - A Perl based tool to parse DMARC reports from an IMAP mailbox or from the filesystem - `GNU GPL v3`, `Perl`
* **[checkdmarc](https://github.com/domainaware/checkdmarc)** - A parser for SPF and DMARC DNS records - `Apache License version 2.0`, `Python`
* **[Viesti-Reports](https://github.com/viesti/viesti-reports)** - DMARC & SMTP-TLS Reports processor and visualizer and BIMI file hoster - `GPL v2`, `PHP`

### Privacy

* **[SimpleLogin](https://simplelogin.io/)** - Protect your online identity with email alias

---

## Disposable Emails Domain List

* **[disposable-email-domains](https://github.com/ivolo/disposable-email-domains)** - a list of disposable and temporary email address domains - `Public Domain`, `Python`
* **[disposable-email-domains (another one)](https://github.com/FGRibreau/mailchecker)** - Disposable email domain lists, used in disposable email services, generated every quarter of an hour, in txt and JSON format. - `MIT`, `PHP`
* **[disposable](https://github.com/disposable/disposable)** - A list of disposable/temporary email address domains - `MIT`, `Python`
* **[disposable-email-domains (another one too)](https://github.com/andreis/disposable)** - Anti-cheating, temporary (disposable/throwaway) email list - `MIT`, `Javascript`
* **[email_data](https://github.com/disposable-email-domains/email_data)** - This project is a compilation of datasets related to emails. Includes disposable emails, disposable domains, and free email services. - `MIT`, `Ruby`
* **[disposable-email-domain-list](https://github.com/7c/fakefilter)** - A list of disposable email domains, cleaned and validated by scanning MX records. - `MIT`, `Python`

---

## Other

* **[Email-Expiration-Manager](https://github.com/retomeier/Email-Expiration-Manager)** - Thunderbird extension for managing emails with expiration dates - `GPL v-3`, `Javascript`

---

## Integration with LeadMap

LeadMap uses several email-related technologies:

- **Email Sending**: Resend, SendGrid, Mailgun, AWS SES, and SMTP for transactional emails
- **Email Templates**: Custom template system with AI-powered rewriting
- **Email Campaigns**: Multi-step email sequences with tracking and analytics
- **Mailbox Management**: Gmail and Outlook OAuth integration, SMTP/IMAP support
- **Email Analytics**: Open/click tracking with time-series analytics
- **Self-Hosted Options**: Hyvor Relay integration guide available (see [HYVOR_RELAY_INTEGRATION.md](./HYVOR_RELAY_INTEGRATION.md))

For more information on LeadMap's email system, see:
- Email system documentation in the main README
- Email API endpoints documentation
- Campaign management guides
- [Hyvor Relay Integration Guide](./HYVOR_RELAY_INTEGRATION.md) - For self-hosted email API setup

---

## Contributing

This resource list is integrated from the [awesome-opensource-email](https://github.com/Mindbaz/awesome-opensource-email) project. If you find additional open-source email resources that should be included, please consider contributing to that repository.

---

## License

This documentation is based on content from [awesome-opensource-email](https://github.com/Mindbaz/awesome-opensource-email), which is licensed under CC0-1.0.

