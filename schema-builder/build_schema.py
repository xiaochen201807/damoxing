#!/usr/bin/env python3
"""
AMIS Schema Template Builder
Renders Jinja2 templates to generate JSON schema files for AMIS pages
"""

import json
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from template_helpers import generate_alert_html

# Color theme (must match colors.j2)
COLORS = {
    'title': '#1d1d1f',
    'subtitle': '#86868b',
    'text': '#1d1d1f',
    'text_secondary': '#666',
    'background': '#f7f8fa',
    'alert_bg': '#f5f5f7',
    'alert_border': '#e5e5ea',
    'chart_colors': ['#3aa1ff', '#36cfc9', '#9254de'],
    'tag_risk_analysis': '#0050b3',
    'tag_avoidance': '#006d75',
    'panel_shadow': '0 4px 12px rgba(0,0,0,0.08)',
    'panel_border': '#f0f0f0',
    'divider': '#e8e8e8'
}

def build_schema(template_name, config_file, output_file):
    """
    Build AMIS schema from Jinja2 template and config file
    
    Args:
        template_name: Template file name (e.g., 'chart_demo.j2')
        config_file: Path to JSON config file (relative to script)
        output_file: Path to output JSON schema file (relative to script)
    """
    # Setup Jinja2 environment
    script_dir = Path(__file__).parent
    template_dir = script_dir / 'templates' / 'pages'
    env = Environment(
        loader=FileSystemLoader(str(template_dir.parent)),
        autoescape=select_autoescape(['html', 'xml']),
        trim_blocks=True,
        lstrip_blocks=True
    )
    
    # Load configuration
    config_path = script_dir / config_file
    if not config_path.exists():
        print(f"❌ Config file not found: {config_file}", file=sys.stderr)
        sys.exit(1)
        
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # Pre-generate alert HTML if content is structured
    if 'content' in config:
        config['alert_html'] = generate_alert_html(config['content'], COLORS)
    
    # Render template
    try:
        template = env.get_template(f'pages/{template_name}')
        rendered = template.render(**config)
    except Exception as e:
        print(f"❌ Template rendering error: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Template already outputs complete JSON object, no need to wrap
    schema_json = rendered
    
    # Parse to validate JSON
    try:
        schema = json.loads(schema_json)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}", file=sys.stderr)
        print(f"Generated content:\n{schema_json}", file=sys.stderr)
        sys.exit(1)
    
    # Write formatted output
    output_path = script_dir / output_file
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schema, f, ensure_ascii=False, indent=4)
    
    print(f"✅ Successfully built schema: {output_file}")
    print(f"   Template: {template_name}")
    print(f"   Config: {config_file}")

if __name__ == '__main__':
    # Build chart demo schema
    build_schema(
        template_name='chart_demo.j2',
        config_file='configs/chart_demo_vars.json',
        output_file='output/demo_chart_schema.json'
    )
