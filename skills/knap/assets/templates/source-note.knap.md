---
{{ title | yaml_property:"title" }}
{% if source %}{{ source | yaml_property:"source" }}
{% endif %}---
# {{ title | trim }}

{{ content }}
