# Little Lantern demo website

A sample public website for a pediatric speech therapy clinic. **Little Lantern Speech
Therapy is fictional**: its name, logo, address, phone number, email, team, testimonials,
and partner organizations are all made up. Replace them with a real clinic's details before
using the site.

It is plain HTML, CSS, and a little JavaScript with no build step, and it is separate from
the Sayso app in the repository root.

| Page                                 | Contents                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| [`index.html`](index.html)           | Hero, why families choose us, therapy areas, steps, reviews |
| [`about.html`](about.html)           | Founding story, what families can expect, values            |
| [`services.html`](services.html)     | Seven services, therapy areas, FAQ                          |
| [`therapists.html`](therapists.html) | Team of six SLPs and advanced trainings                     |
| [`join-us.html`](join-us.html)       | Careers                                                     |
| [`partners.html`](partners.html)     | Partner organizations and family resources                  |
| [`contact.html`](contact.html)       | Address, hours, illustrated map, contact form               |
| [`404.html`](404.html)               | Not-found page                                              |

## Preview locally

```bash
cd website
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Deploy

Any static host works. On Vercel, create a **new project** from this repository, set
**Root Directory** to `website`, and choose the **Other** framework preset with no build
command.

## Contact form

A static site has no server to receive form posts, so by default **Send message** opens an
email draft to the clinic's address. To receive submissions directly, create a form with a
service such as Formspree or Basin and put its endpoint in the form's `data-endpoint`
attribute in `contact.html`:

```html
<form
  class="form"
  id="contact-form"
  data-endpoint="https://formspree.io/f/your-id"
></form>
```

The form asks for the insurance holder's name, so choose a provider whose privacy terms the
clinic is comfortable with.

## Making it real

- Replace the name, logo (`assets/mark.svg`, `favicon.svg`), contact details, team, and
  testimonials. The phone number uses the reserved 555-01xx range and the email uses the
  reserved `.example` domain.
- Swap the illustrated map on the contact page for a real map embed.
- Add photos of the clinic and team; the therapist cards currently show initials.
- Add a 1200×630 social sharing image and reference it with `og:image`.
