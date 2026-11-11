#!/usr/bin/env python3
"""
Aarogya Drishti — Server-Side OpenCV Image Quality Assessment Pipeline

Evaluates oral photograph quality using OpenCV and NumPy:
1. Resolution & Aspect Ratio: Checks dimensions (minimum 224x224, ideal >= 512x512).
2. Blur Detection: Computes variance of discrete Laplacian operator (cv2.Laplacian).
3. Illumination: Measures mean luminance, dark regions (< 20), and specular glare reflections (>= 245).
4. Contrast: Measures standard deviation across oral tissues.
5. Actionable Bilingual Feedback: Generates English and Telugu guidance.

Usage:
  python scripts/quality-check.py path/to/image.jpg
  python scripts/quality-check.py < payload.json
"""

import sys
import json
import base64
import io

QUALITY_FEEDBACK = {
    'TOO_SMALL': {
        'en': 'Image resolution is too low; minimum 224 × 224 pixels required.',
        'te': 'చిత్రం రిజల్యూషన్ చాలా తక్కువగా ఉంది; కనీసం 224 × 224 పిక్సెల్‌లు అవసరం.'
    },
    'TOO_DARK': {
        'en': 'Image is too dark; please use adequate lighting or camera flash.',
        'te': 'చిత్రం చాలా చీకటిగా ఉంది; దయచేసి తగినంత వెలుతురు లేదా ఫ్లాష్ ఉపయోగించండి.'
    },
    'TOO_BRIGHT_GLARE': {
        'en': 'Image has intense glare or overexposure; adjust lighting angle to reduce reflection.',
        'te': 'చిత్రంలో తీవ్రమైన మెరుపు లేదా మితిమీరిన కాంతి ఉంది; కాంతి కోణాన్ని సర్దుబాటు చేయండి.'
    },
    'LOW_CONTRAST': {
        'en': 'Image has low contrast; ensure oral cavity is clearly separated from background.',
        'te': 'చిత్రంలో కాంట్రాస్ట్ తక్కువగా ఉంది; నోటి భాగం స్పష్టంగా కనిపించేలా చూడండి.'
    },
    'BLURRY': {
        'en': 'Image is blurry; please hold the camera steady and refocus on the teeth.',
        'te': 'చిత్రం అస్పష్టంగా ఉంది; దయచేసి కెమెరాను స్థిరంగా ఉంచి పళ్ళపై దృష్టి పెట్టండి.'
    },
    'EXTREME_ASPECT_RATIO': {
        'en': 'Image aspect ratio is unusual; capture oral area directly without excessive cropping.',
        'te': 'చిత్రం నిష్పత్తి అసాధారణంగా ఉంది; నోటి భాగాన్ని నేరుగా ఫోటో తీయండి.'
    },
    'PASSED': {
        'en': 'Oral photograph meets basic quality standards for clinician review.',
        'te': 'వైద్యుల సమీక్ష కోసం నోటి ఛాయాచిత్రం నాణ్యతా ప్రమాణాలకు అనుగుణంగా ఉంది.'
    }
}

def analyze_image_bytes(raw_bytes):
    try:
        import cv2
        import numpy as np
    except ImportError as e:
        return {
            'pass': False,
            'error': f'OpenCV or NumPy is not installed: {str(e)}',
            'status': 'dependency_missing'
        }

    # Decode image from memory
    nparr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {'pass': False, 'error': 'Could not decode image bytes.', 'status': 'corrupted'}

    height, width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Blur Detection via Laplacian Variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(laplacian.var())

    # 2. Illumination & Contrast
    mean_val, std_val = cv2.meanStdDev(gray)
    brightness = float(mean_val[0][0])
    contrast = float(std_val[0][0])

    # 3. Glare and Darkness pixel ratios
    total_pixels = width * height
    glare_pixels = int(np.sum(gray >= 245))
    dark_pixels = int(np.sum(gray <= 20))
    glare_ratio = glare_pixels / total_pixels
    dark_ratio = dark_pixels / total_pixels

    issues = []
    en_feedback = []
    te_feedback = []

    # Evaluation against clinical thresholds
    if width < 200 or height < 200:
        issues.append('TOO_SMALL')
        en_feedback.append(QUALITY_FEEDBACK['TOO_SMALL']['en'])
        te_feedback.append(QUALITY_FEEDBACK['TOO_SMALL']['te'])

    aspect_ratio = width / max(1, height)
    if aspect_ratio < 0.33 or aspect_ratio > 3.0:
        issues.append('EXTREME_ASPECT_RATIO')
        en_feedback.append(QUALITY_FEEDBACK['EXTREME_ASPECT_RATIO']['en'])
        te_feedback.append(QUALITY_FEEDBACK['EXTREME_ASPECT_RATIO']['te'])

    if brightness < 45 or dark_ratio > 0.60:
        issues.append('TOO_DARK')
        en_feedback.append(QUALITY_FEEDBACK['TOO_DARK']['en'])
        te_feedback.append(QUALITY_FEEDBACK['TOO_DARK']['te'])

    if brightness > 225 or glare_ratio > 0.30:
        issues.append('TOO_BRIGHT_GLARE')
        en_feedback.append(QUALITY_FEEDBACK['TOO_BRIGHT_GLARE']['en'])
        te_feedback.append(QUALITY_FEEDBACK['TOO_BRIGHT_GLARE']['te'])

    if contrast < 18:
        issues.append('LOW_CONTRAST')
        en_feedback.append(QUALITY_FEEDBACK['LOW_CONTRAST']['en'])
        te_feedback.append(QUALITY_FEEDBACK['LOW_CONTRAST']['te'])

    if blur_score < 100:
        issues.append('BLURRY')
        en_feedback.append(QUALITY_FEEDBACK['BLURRY']['en'])
        te_feedback.append(QUALITY_FEEDBACK['BLURRY']['te'])

    score = 100
    if 'TOO_SMALL' in issues: score -= 40
    if 'TOO_DARK' in issues: score -= 35
    if 'TOO_BRIGHT_GLARE' in issues: score -= 35
    if 'BLURRY' in issues: score -= 30
    if 'LOW_CONTRAST' in issues: score -= 25
    if 'EXTREME_ASPECT_RATIO' in issues: score -= 20

    if not issues and contrast >= 35 and blur_score >= 150:
        score = min(100, int(85 + min(15, blur_score / 50)))
    else:
        score = max(0, score)

    passed = len(issues) == 0
    if passed:
        en_feedback.append(QUALITY_FEEDBACK['PASSED']['en'])
        te_feedback.append(QUALITY_FEEDBACK['PASSED']['te'])

    return {
        'pass': passed,
        'score': score,
        'status': 'passed' if passed else 'retake_recommended',
        'metrics': {
            'width': width,
            'height': height,
            'brightness': round(brightness, 1),
            'contrast': round(contrast, 1),
            'blurScore': round(blur_score, 1),
            'glareRatio': round(glare_ratio * 100, 1),
            'darkRatio': round(dark_ratio * 100, 1)
        },
        'issues': issues,
        'feedback': {
            'en': en_feedback,
            'te': te_feedback
        }
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] != '--check':
        from pathlib import Path
        file_path = Path(sys.argv[1])
        if not file_path.exists():
            print(json.dumps({'error': f'File not found: {file_path}'}), file=sys.stderr)
            sys.exit(1)
        raw_bytes = file_path.read_bytes()
    else:
        input_data = sys.stdin.read(4_000_000)
        if not input_data.strip():
            print(json.dumps({'error': 'No input provided'}), file=sys.stderr)
            sys.exit(1)
        try:
            parsed = json.loads(input_data)
            photo = parsed.get('photo', '')
            if photo.startswith('data:image/'):
                raw_bytes = base64.b64decode(photo.split(',', 1)[1])
            else:
                raw_bytes = base64.b64decode(photo)
        except Exception:
            raw_bytes = input_data.encode('utf-8')

    result = analyze_image_bytes(raw_bytes)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
