import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { FONTS } from '../components/PageStyle.jsx';
import pageCss from './css/sample-certificate-preview.css?inline';

/** QueryDict.get(key, default): last value of a key, or `fallback` when the key is absent. */
function getParam(searchParams, key, fallback) {
  const all = searchParams.getAll(key);
  return all.length ? all[all.length - 1] : fallback;
}

/** Percent-encode every character of `value` (UTF-8) that is not in `safe` / unreserved. */
function quote(value, safe) {
  let out = '';
  for (const ch of String(value)) {
    if (/[A-Za-z0-9_.\-~]/.test(ch) || safe.includes(ch)) out += ch;
    else out += Array.from(new TextEncoder().encode(ch), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  }
  return out;
}

/** django.utils.encoding.iri_to_uri (applied by request.build_absolute_uri). */
const iriToUri = (iri) => quote(iri, "/#%[]=:;$&()+,!?*@'~");

/** Django's `|urlencode` filter (urllib.parse.quote with safe='/'). */
const urlencode = (value) => quote(value, '/');

/** React port of templates/sample_certificate_preview.html (pehchan.views.sample_certificate_preview). */
export default function SampleCertificatePreview() {
  const [searchParams] = useSearchParams();
  const qrFallbackTried = useRef(new WeakSet());

  const certificateNumber = getParam(searchParams, 'cert_id', 'PYUI/2026/V/0042');
  const recipientName = getParam(searchParams, 'name', 'ANIKSHA UPADHYAY');
  const eventName = getParam(searchParams, 'event', 'YOUTH EMPOWERMENT DRIVE 2026');
  const eventDate = getParam(searchParams, 'date', 'November 03, 2026');
  const eventLocation = getParam(searchParams, 'location', 'Mumbai');
  const issueDate = getParam(searchParams, 'issue_date', '03 Nov 2026');

  // request.build_absolute_uri(f"/verify-certificate/?cert_id={cert_no}")
  const verificationUrl = iriToUri(`${window.location.origin}/verify-certificate/?cert_id=${certificateNumber}`);
  const qrFallback = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${urlencode(verificationUrl)}`;

  return (
    <BaseLayout title="Certificate Preview - Pehchan YUI Foundation" extraLinks={[FONTS.certificate]} extraCss={pageCss}>
      <div className="cert-preview-page">

        {/* Controls Bar */}
        <div className="cert-controls-bar">
          <div className="cert-controls-left">
            <h2>
              <span className="material-icons-round" style={{ color: '#175440' }}>verified</span> Pehchan YUI Foundation - Official Certificate
            </h2>
            <p>Unified typography &amp; authentic styling with 3D Gold Coin and live QR Verification</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => window.print()} className="cert-action-btn cert-action-btn--primary">
              <span className="material-icons-round">print</span> Print / Save as PDF
            </button>
            <Link to={`/verify-certificate/?cert_id=${certificateNumber}`} target="_blank" className="cert-action-btn cert-action-btn--outline">
              <span className="material-icons-round">qr_code_scanner</span> Test QR Verify
            </Link>
          </div>
        </div>

        {/* Certificate Canvas */}
        <div className="cert-canvas-wrapper" id="certificateCanvas">
          <div className="certificate-frame">

            {/* Global Double Border spanning full width underneath ribbon */}
            <div className="cert-full-outer-border"></div>
            <div className="cert-full-inner-border"></div>
            <div className="corner-ornament corner-tl"></div>
            <div className="corner-ornament corner-tr"></div>
            <div className="corner-ornament corner-bl"></div>
            <div className="corner-ornament corner-br"></div>

            {/* Vertical Royal Navy-Purple Ribbon */}
            <div className="cert-right-ribbon">

              {/* Circular Pehchan Round Badge Logo */}
              <div className="ribbon-top-block">
                <div className="ribbon-circle-logo-wrapper">
                  <img src="/static/images/logos/pehchan_round_blue.png" alt="Pehchan Round Badge" className="ribbon-circle-logo" />
                </div>
              </div>

              {/* Real 3D Metallic Embossed Gold Coin "THANK YOU" */}
              <div className="ribbon-golden-coin-container">
                <img src="/static/images/gold_coin_thank_you.png" alt="Thank You Gold Coin" className="ribbon-gold-coin-img" />
              </div>

              {/* Ribbon Bottom Tagline */}
              <div className="ribbon-bottom-block">
                <span className="ribbon-star-sparkle">✦</span>
                <div className="ribbon-bottom-text">
                  PEHCHAN YUI<br />FOUNDATION
                </div>
              </div>

            </div>

            {/* Main Certificate Body Content */}
            <div className="cert-body-content">

              {/* Top Header: Official Transparent Emblem */}
              <div className="cert-header">
                <img src="/static/images/logos/pehchan_official_emblem.png" alt="Pehchan Official Emblem" className="cert-top-logo" />
                <h1 className="cert-foundation-name">PEHCHAN YUI FOUNDATION</h1>
                <p className="cert-foundation-reg">(Registered Public Trust Reg. No: E-0015289 (THN))</p>
              </div>

              {/* Certificate Title */}
              <div className="cert-title-section">
                <h2 className="cert-main-title">CERTIFICATE</h2>
                <h3 className="cert-subtitle">OF APPRECIATION</h3>
              </div>

              {/* Recipient & Event Participation Citation */}
              <div className="cert-recipient-section">
                <p className="cert-awarded-text">This certificate is proudly awarded to</p>
                <h2 className="cert-recipient-name">{recipientName}</h2>
                <div className="cert-citation-wrapper">
                  <span className="cert-citation-intro">in recognition of dedicated and valuable voluntary service in the initiative/event</span>{' '}
                  <span className="cert-event-name">“{eventName}”</span>{' '}
                  <span className="cert-event-venue">held on {eventDate}, in {eventLocation}.</span>
                </div>
              </div>

              {/* Bottom Footer (Cert No / QR / Signature) */}
              <div className="cert-footer-section">
                <div className="cert-footer-left">
                  {/* Dynamic Verification QR Code */}
                  <div className="cert-qr-box">
                    <img
                      key={qrFallback}
                      src="/static/images/sample_cert_qr.png"
                      alt="Verify Certificate QR"
                      className="cert-qr-img"
                      onError={(e) => {
                        // onerror="this.src='https://api.qrserver.com/…'" (guarded so a failing fallback cannot loop)
                        const img = e.currentTarget;
                        if (qrFallbackTried.current.has(img)) return;
                        qrFallbackTried.current.add(img);
                        img.src = qrFallback;
                      }}
                    />
                    <span className="cert-qr-caption">Scan to Verify</span>
                  </div>
                  <div className="cert-meta-info">
                    <div>Certificate No: <span className="cert-meta-number">{certificateNumber}</span></div>
                    <div>Date of Issue: {issueDate}</div>
                  </div>
                </div>

                <div className="cert-footer-right">
                  <p className="cert-cursive-signature">Aniksha Upadhyay</p>
                  <p className="cert-sign-name">Aniksha Upadhyay</p>
                  <p className="cert-sign-title">Founder</p>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </BaseLayout>
  );
}
