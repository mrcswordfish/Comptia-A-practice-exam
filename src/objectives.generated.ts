export const OBJECTIVES = {
  "220-1201": {
    "1.1": {
      "domain": "1.0 Mobile Devices",
      "title": "Given a scenario, monitor mobile device hardware and use appropriate replacement techniques.",
      "bullets": ["Battery", "Keyboard/keys", "RAM", "HDD/SSD", "Wireless cards", "Camera/webcam", "Microphone"]
    },
    "1.2": {
      "domain": "1.0 Mobile Devices",
      "title": "Given a scenario, set up and configure mobile devices.",
      "bullets": ["Bluetooth", "Wi-Fi", "Email", "Security settings", "Synchronization", "Mobile apps"]
    },
    "2.1": {
      "domain": "2.0 Networking",
      "title": "Compare and contrast TCP and UDP ports, protocols, and their purposes.",
      "bullets": ["20-21 – FTP", "22 – SSH", "23 – Telnet", "25 – SMTP", "53 – DNS", "67/68 – DHCP", "80 – HTTP", "443 – HTTPS", "445 – SMB", "3389 – RDP"]
    },
    "2.2": {
      "domain": "2.0 Networking",
      "title": "Compare and contrast common Wi-Fi standards and encryption types.",
      "bullets": ["2.4GHz vs 5GHz vs 6GHz", "802.11n/ac/ax", "WPA2/WPA3", "AES vs TKIP", "Channel selection", "Signal/interference"]
    },
    "2.7": {
      "domain": "2.0 Networking",
      "title": "Summarize basic networking concepts.",
      "bullets": ["IP addressing", "Subnet mask", "Default gateway", "DNS", "DHCP", "NAT"]
    },
    "3.2": {
      "domain": "3.0 Hardware",
      "title": "Summarize basic cable types and their connectors, features, and purposes.",
      "bullets": ["RJ-45", "RJ-11", "LC/SC/ST", "HDMI/DisplayPort", "USB-C", "Lightning", "Cat5e/Cat6", "Single-mode vs multimode fiber"]
    },
    "3.4": {
      "domain": "3.0 Hardware",
      "title": "Compare and contrast storage devices.",
      "bullets": ["HDD vs SSD", "NVMe vs SATA", "RAID 0/1/5/10", "Hot-swappable", "S.M.A.R.T."]
    },
    "3.7": {
      "domain": "3.0 Hardware",
      "title": "Given a scenario, install and configure printers.",
      "bullets": ["Driver installation", "PCL vs PostScript", "Network printing", "Print spooler", "Calibration/maintenance"]
    },
    "4.2": {
      "domain": "4.0 Virtualization and Cloud Computing",
      "title": "Compare and contrast cloud computing concepts.",
      "bullets": ["Public/private/hybrid", "IaaS/PaaS/SaaS", "Elasticity", "High availability", "Shared responsibility"]
    },
    "5.2": {
      "domain": "5.0 Hardware and Network Troubleshooting",
      "title": "Given a scenario, troubleshoot drive and RAID issues.",
      "bullets": ["S.M.A.R.T. errors", "RAID rebuild", "Failed disk", "Boot device not found", "Performance degradation"]
    },
    "5.5": {
      "domain": "5.0 Hardware and Network Troubleshooting",
      "title": "Given a scenario, troubleshoot network issues.",
      "bullets": ["DNS issues", "DHCP issues", "Intermittent connectivity", "IP conflict", "Bad cable/port", "Wireless interference"]
    },
    "5.6": {
      "domain": "5.0 Hardware and Network Troubleshooting",
      "title": "Given a scenario, troubleshoot printer issues.",
      "bullets": ["Faded prints", "Lines/streaks", "Paper jams", "Garbled output", "Driver mismatch", "Spooler issues"]
    }
  },
  "220-1202": {
    "1.3": {
      "domain": "1.0 Operating Systems",
      "title": "Given a scenario, use Microsoft Windows settings and control panel utilities.",
      "bullets": ["Event Viewer", "Disk Management", "Device Manager", "Services", "Task Manager", "System Configuration"]
    },
    "1.4": {
      "domain": "1.0 Operating Systems",
      "title": "Given a scenario, use Windows command-line tools.",
      "bullets": ["ipconfig", "ping", "tracert", "netstat", "sfc", "chkdsk"]
    },
    "2.3": {
      "domain": "2.0 Security",
      "title": "Compare and contrast wireless security protocols and encryption.",
      "bullets": ["WPA2/WPA3", "AES vs TKIP", "Enterprise vs Personal", "Captive portal basics"]
    },
    "2.4": {
      "domain": "2.0 Security",
      "title": "Compare and contrast malware types, symptoms, and removal methods.",
      "bullets": ["Trojan", "Rootkit", "Ransomware", "Spyware", "Keylogger", "Fileless malware", "Cryptominer"]
    },
    "2.7": {
      "domain": "2.0 Security",
      "title": "Explain common security controls.",
      "bullets": ["Least privilege", "MFA", "Screen locks", "Disable AutoRun", "Patch management", "Secure baselines"]
    },
    "3.4": {
      "domain": "3.0 Software Troubleshooting",
      "title": "Given a scenario, troubleshoot common security issues.",
      "bullets": ["Pop-ups/redirects", "Slow performance", "Unexpected reboots", "Browser hijacking"]
    },
    "4.1": {
      "domain": "4.0 Operational Procedures",
      "title": "Given a scenario, implement best practices associated with documentation and support systems.",
      "bullets": ["Ticketing systems", "Asset management", "Knowledge base", "Escalation", "Documentation"]
    },
    "4.2": {
      "domain": "4.0 Operational Procedures",
      "title": "Given a scenario, apply change management procedures.",
      "bullets": ["Risk analysis", "Backout plan", "Approval", "Maintenance windows", "Post-change review"]
    },
    "4.3": {
      "domain": "4.0 Operational Procedures",
      "title": "Given a scenario, implement workstation backup and recovery methods.",
      "bullets": ["Full/differential/incremental", "3-2-1 rule", "Restore testing", "System restore vs image recovery"]
    },
    "4.7": {
      "domain": "4.0 Operational Procedures",
      "title": "Given a scenario, use proper communication techniques and professionalism.",
      "bullets": ["Clarify scope", "Set expectations", "Document actions", "De-escalation", "Follow-up"]
    },
    "4.9": {
      "domain": "4.0 Operational Procedures",
      "title": "Given a scenario, use remote access technologies.",
      "bullets": ["RDP", "SSH", "VPN", "VNC", "Remote Assistance", "Security considerations"]
    }
  }
} as const;
