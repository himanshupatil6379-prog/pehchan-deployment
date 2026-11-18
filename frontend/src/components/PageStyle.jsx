/**
 * Renders page-scoped stylesheets in DOM order, exactly like the <link>/<style>
 * tags inside a Django template's <head>. They are removed automatically when
 * the page unmounts, so one page's CSS never leaks into another page.
 *
 *   import pageCss from './css/home.css?inline';
 *   <PageStyle links={[FONTS.poppins]} css={pageCss} />
 */
export default function PageStyle({ css, links }) {
  const cssList = Array.isArray(css) ? css : css ? [css] : [];
  const linkList = links || [];
  return (
    <>
      {linkList.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {cssList.map((c, i) => (
        <style key={i}>{c}</style>
      ))}
    </>
  );
}

/** External stylesheet URLs used by the original templates. */
export const FONTS = {
  materialIcons: 'https://fonts.googleapis.com/icon?family=Material+Icons',
  materialIconsRound: 'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  interJakarta:
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  poppins: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  poppins800: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  certificate:
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
};
