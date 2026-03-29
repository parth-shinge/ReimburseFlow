from django.core.management.base import BaseCommand
from apps.accounts.models import Company, User
from apps.expenses.models import Expense
from apps.approvals.models import ApprovalRule, ApprovalStep
from decimal import Decimal
from datetime import date, timedelta
import uuid

class Command(BaseCommand):
    help = 'Seeds the database with demo data for presentation'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')

        # Create company
        company, _ = Company.objects.get_or_create(
            name='Acme Corporation',
            defaults={'country': 'India', 'currency': 'INR'}
        )

        # Create admin
        admin, _ = User.objects.get_or_create(
            email='admin@acme.com',
            defaults={'name': 'Admin User', 'role': 'ADMIN', 'company': company, 'is_active': True}
        )
        if admin._state.adding or not admin.has_usable_password():
            admin.set_password('Admin1234')
            admin.save()

        # Create manager
        manager, _ = User.objects.get_or_create(
            email='manager@acme.com',
            defaults={'name': 'Sarah Manager', 'role': 'MANAGER', 'company': company, 'is_manager_approver': True, 'is_active': True}
        )
        if manager._state.adding or not manager.has_usable_password():
            manager.set_password('Manager1234')
            manager.save()

        # Create employees
        emp1, _ = User.objects.get_or_create(
            email='john@acme.com',
            defaults={'name': 'John Employee', 'role': 'EMPLOYEE', 'company': company, 'manager': manager, 'is_active': True}
        )
        if emp1._state.adding or not emp1.has_usable_password():
            emp1.set_password('Employee1234')
            emp1.save()

        emp2, _ = User.objects.get_or_create(
            email='priya@acme.com',
            defaults={'name': 'Priya Singh', 'role': 'EMPLOYEE', 'company': company, 'manager': manager, 'is_active': True}
        )
        if emp2._state.adding or not emp2.has_usable_password():
            emp2.set_password('Employee1234')
            emp2.save()

        # Create approval rule
        rule, _ = ApprovalRule.objects.get_or_create(
            company=company,
            name='Standard Sequential Approval',
            defaults={'rule_type': 'SEQUENTIAL', 'is_active': True}
        )
        if not rule.steps.exists():
            ApprovalStep.objects.create(rule=rule, approver=manager, step_order=1)
            ApprovalStep.objects.create(rule=rule, approver=admin, step_order=2)

        # Create sample expenses
        expenses_data = [
            {'submitted_by': emp1, 'amount': Decimal('2500'), 'currency': 'INR', 'amount_in_company_currency': Decimal('2500'), 'category': 'TRAVEL', 'description': 'Cab to client office', 'date': date.today() - timedelta(days=5), 'status': 'APPROVED'},
            {'submitted_by': emp1, 'amount': Decimal('850'), 'currency': 'INR', 'amount_in_company_currency': Decimal('850'), 'category': 'FOOD', 'description': 'Team lunch with client', 'date': date.today() - timedelta(days=3), 'status': 'PENDING'},
            {'submitted_by': emp2, 'amount': Decimal('15000'), 'currency': 'INR', 'amount_in_company_currency': Decimal('15000'), 'category': 'EQUIPMENT', 'description': 'Mechanical keyboard for remote work', 'date': date.today() - timedelta(days=1), 'status': 'PENDING'},
            {'submitted_by': emp2, 'amount': Decimal('5500'), 'currency': 'INR', 'amount_in_company_currency': Decimal('5500'), 'category': 'ACCOMMODATION', 'description': 'Hotel stay during Bangalore conference', 'date': date.today() - timedelta(days=10), 'status': 'REJECTED'},
        ]

        for exp_data in expenses_data:
            Expense.objects.get_or_create(
                submitted_by=exp_data['submitted_by'],
                description=exp_data['description'],
                defaults=exp_data
            )

        self.stdout.write(self.style.SUCCESS('''
Demo data seeded successfully!

Login credentials:
  Admin:    admin@acme.com    / Admin1234
  Manager:  manager@acme.com  / Manager1234
  Employee: john@acme.com     / Employee1234
  Employee: priya@acme.com    / Employee1234
        '''))
