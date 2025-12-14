"""
Helper functions for template rendering
"""

def generate_alert_html(content, colors):
    """
    Generate rich HTML for alert/info box with structured content
    
    Args:
        content: dict with title and sections
        colors: color theme dict
    
    Returns:
        HTML string
    """
    html_parts = []
    # Match panel component border-radius (8px) and use white background
    html_parts.append("<div style='background-color: #ffffff; border: 1px solid #d9d9d9; border-radius: 8px; padding: 20px 24px; line-height: 1.7;'>")
    
    # Main title - larger, bolder, with left decorative border
    if content.get('title'):
        html_parts.append(f"<div style='color: #1d1d1f; font-weight: 700; font-size: 16px; margin-bottom: 18px; padding-left: 12px; border-left: 4px solid #1890ff;'>{content['title']}</div>")
    
    # Sections
    sections = content.get('sections', [])
    for i, section in enumerate(sections):
        is_last = (i == len(sections) - 1)
        margin = '0' if is_last else '20px'
        html_parts.append(f"<div style='margin-bottom: {margin};'>")
        
        # Section heading (blue) - smaller than main title, no border
        if section.get('heading'):
            html_parts.append(f"<div style='color: #1890ff; font-weight: 600; font-size: 14px; margin-bottom: 12px;'>{section['heading']}</div>")
        
        # Section text - dark text on white background
        if section.get('text'):
            html_parts.append(f"<div style='color: #333; font-size: 13px; line-height: 1.8; margin-bottom: 12px; text-align: justify;'>{section['text']}</div>")
        
        # Section items (numbered list) - proper indentation
        if section.get('items'):
            html_parts.append("<div style='padding-left: 0; margin-top: 10px;'>")
            for idx, item in enumerate(section['items'], 1):
                # Use hanging indent for numbered lists
                html_parts.append(f"<div style='color: #555; font-size: 13px; line-height: 1.8; margin-bottom: 10px; padding-left: 24px; text-indent: -24px; text-align: justify;'>{idx}. {item}</div>")
            html_parts.append("</div>")
        
        html_parts.append("</div>")
    
    html_parts.append("</div>")
    return ''.join(html_parts)
