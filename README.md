# Supanauts

**Meet people. Build things.** Supanauts is an independently organized, unofficial Supabase community for builders, meetups, and shared projects. [supanauts.com](https://supanauts.com/)

This private repository contains the community website and its database schema.

## Run locally

Use Node.js 22 and npm.

```sh
git clone https://github.com/teemukinos/Supanauts.git
cd Supanauts/site
npm ci
npm run dev
```

Open [http://127.0.0.1:3017](http://127.0.0.1:3017). Public pages work without credentials. For sign-in, membership, rewards, and organizer tools, follow the [application setup guide](site/README.md) using your own development services.

## Explore the source

- [Application](site/app/) and [server helpers](site/lib/)
- [Database migrations](supabase/migrations/)
- [Community calendar](docs/calendar/README.md) and [event archive](docs/EVENT-ARCHIVE.md)

## Contribute

Use [GitHub Issues](https://github.com/teemukinos/Supanauts/issues) to report bugs or suggest changes. Propose code changes through a pull request against `main`. Once the repository is public, community contributors can submit pull requests from forks. The maintainer, [@teemukinos](https://github.com/teemukinos), manually squash-merges accepted pull requests. See the [contribution guide](CONTRIBUTING.md) and [governance policy](GOVERNANCE.md). Report vulnerabilities privately to the maintainer.

## License

Original code and illustrations use [Apache-2.0](LICENSE). Third-party assets retain their own terms. Supabase trademarks are outside the code license. See the [third-party notices](THIRD_PARTY_NOTICES.md).

The repository includes editorial event listings and public SupaSquad profiles. Production credentials, private membership records, attendee exports, reward codes, and original event media stay outside Git.
