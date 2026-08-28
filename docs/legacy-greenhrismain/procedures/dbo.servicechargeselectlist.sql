-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-8-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[servicechargeselectlist]
	-- Add the parameters for the stored procedure here
		@keytext nvarchar(50),
		--@chkallclient bit,
		@iddepartment int,
		@idclient int,
		@status varchar(20),
		@datefrom date, 
		@enddate date,
		@payoutdate date

	--	@thirteenyear varchar(4),
	--	@payoutdate nvarchar(20)
				
AS
BEGIN


--clean first 
UPDATE       Employee
SET                tempforthirteenmonthstatus = NULL
FROM            Employee INNER JOIN
                         payroll_summary ON Employee.Employee_id = payroll_summary.Employee_id


UPDATE       Employee
SET                tempforthirteenmonthstatus = 'Active'
FROM            Employee INNER JOIN
                         payroll_summary ON Employee.Employee_id = payroll_summary.Employee_id
WHERE        (payroll_summary.idclientp = @idclient)



IF (@keytext IS NULL OR @keytext = '') 
Begin

	SELECT        dbo.servicecharge.employee_id as scempid,dbo.employee.employee_id, dbo.Employee.lname, dbo.Employee.fname, dbo.Employee.mname, dbo.Employee.dailyrate, dbo.Employee.idclient, dbo.client_branch_position.jobposition, dbo.Department.Department_desc, 
                         dbo.client.companyname, dbo.Employee.department_code, dbo.Employee.typeofcontract, dbo.Employee.tagdelete, dbo.Employee.Position1, dbo.Employee.paythrough, dbo.Employee.bankaccountno, 
                         dbo.Employee.employee_status, dbo.Employee.bankname, dbo.Employee.status, dbo.Employee.tempforthirteenmonthstatus, dbo.servicecharge.payoutdate, dbo.servicecharge.fromdate, dbo.servicecharge.enddate
	FROM            dbo.Employee INNER JOIN
                         dbo.client ON dbo.Employee.idclient = dbo.client.idclient 
						 INNER JOIN dbo.client_branch_position ON dbo.Employee.Position1 = dbo.client_branch_position.idbranchposition 
						 INNER JOIN dbo.Department ON dbo.Employee.department_code = dbo.Department.iddepartment 
						 LEFT OUTER JOIN  dbo.servicecharge ON dbo.Employee.Employee_id = dbo.servicecharge.employee_id
						 AND employee.idclient = servicecharge.idclient
						 AND servicecharge.fromdate = @datefrom
						 AND servicecharge.enddate = @enddate
		WHERE (employee.department_code = @iddepartment) 
		AND (client.idclient = @idclient) 
		AND (employee.tagdelete = 'N') 
		AND	(servicecharge.Employee_id IS NULL)
		ORDER BY employee.lname, employee.fname
			
End


IF (@keytext Is Not NULL OR @keytext <> '') 
Begin

	SELECT        dbo.servicecharge.employee_id as scempid,dbo.employee.employee_id, dbo.Employee.lname, dbo.Employee.fname, dbo.Employee.mname, dbo.Employee.dailyrate, dbo.Employee.idclient, dbo.client_branch_position.jobposition, dbo.Department.Department_desc, 
                         dbo.client.companyname, dbo.Employee.department_code, dbo.Employee.typeofcontract, dbo.Employee.tagdelete, dbo.Employee.Position1, dbo.Employee.paythrough, dbo.Employee.bankaccountno, 
                         dbo.Employee.employee_status, dbo.Employee.bankname, dbo.Employee.status, dbo.Employee.tempforthirteenmonthstatus, dbo.servicecharge.payoutdate, dbo.servicecharge.fromdate, dbo.servicecharge.enddate
	FROM            dbo.Employee INNER JOIN
                         dbo.client ON dbo.Employee.idclient = dbo.client.idclient 
						 INNER JOIN dbo.client_branch_position ON dbo.Employee.Position1 = dbo.client_branch_position.idbranchposition 
						 INNER JOIN dbo.Department ON dbo.Employee.department_code = dbo.Department.iddepartment 
						LEFT OUTER JOIN    servicecharge  ON employee.Employee_id = servicecharge.Employee_id AND employee.idclient = servicecharge.idclient AND servicecharge.fromdate =@datefrom
						
						 AND employee.idclient = servicecharge.idclient
						 AND servicecharge.fromdate = @datefrom
						 AND servicecharge.enddate = @enddate
		
		WHERE  (servicecharge.Employee_id IS NULL) 	and	   (client.idclient = @idclient) 
			and  (employee.lname LIKE N'%' + @keytext + N'%')  or (employee.fname LIKE N'%' + @keytext + N'%') 
		
	--	(employee.status = 'Active') 
	--	AND (employee.tagdelete = 'N') 
	--	AND (employee.fname LIKE '%' + @keytext + '%') OR(employee.status = 'Active') AND (employee.tagdelete = 'N') 
	--	AND (employee.lname LIKE '%' + @keytext + '%') OR (employee.status = 'Active') 
	--	AND (employee.tagdelete = 'N')
	--	AND (client_branch_position.jobposition LIKE '%' + @keytext + '%')
	--	AND (client.idclient = @idclient) 
		

		--(employee.department_code = @iddepartment) 
		
		--AND (employee.tagdelete = 'N') 
		--AND	(servicecharge.Employee_id IS NULL)			
		-- and (Employee.lname LIKE + N'%' + @keytext + N'%') Or (Employee.Fname LIKE + N'%' + @keytext + N'%')
	--	ORDER BY employee.lname, employee.fname
			
End





/*

IF (@status IS NULL OR @status = '' and  (@keytext Is Not NULL OR @keytext <> ''))
Begin

SELECT        Employee.Employee_id, Employee.lname, Employee.fname, Employee.mname, Employee.dailyrate, Employee.idclient, client_branch_position.jobposition, Department.Department_desc, client.companyname, 
                         Employee.department_code, Employee.typeofcontract, Employee.tagdelete, Employee.Position1, Employee.paythrough, Employee.bankaccountno, Employee.employee_status, Employee.bankname, Employee.status, 
                         Employee.tempforthirteenmonthstatus, servicecharge.payoutdate, servicecharge.fromdate, servicecharge.enddate
FROM            Employee INNER JOIN
                         client ON Employee.idclient = client.idclient INNER JOIN
                         client_branch_position ON Employee.Position1 = client_branch_position.idbranchposition INNER JOIN
                         Department ON Employee.department_code = Department.iddepartment INNER JOIN
                         servicecharge ON Employee.Employee_id = servicecharge.employee_id AND Employee.idclient = servicecharge.idclient

  wHERE (Employee.lname LIKE + N'%' + @keytext + N'%') Or (Employee.Fname LIKE + N'%' + @keytext + N'%')

--WHERE  Employee.LNAME LIKE '%ABA%'

--(Employee.fname LIKE + N'%' + @keytext + N'%')  and	 (Employee.lname LIKE + N'%' + @keytext + N'%')
	
--	AND servicecharge.enddate = @enddate

--		WHERE 
--		(employee.department_code = @iddepartment) 
--		AND (client.idclient = @idclient) 
--		AND (employee.tagdelete = 'N') 
--		AND	(servicecharge.Employee_id IS NULL)
--		AND (Employee.fname LIKE + N'%' + @keytext + N'%')  and	 (Employee.lname LIKE + N'%' + @keytext + N'%')
		--ORDER BY employee.lname, employee.fname
			
End






--WHERE        (servicechargeselectviewlist.fname LIKE + N'%' + @keytext + N'%') or (servicechargeselectviewlist.lname LIKE + N'%' + @keytext + N'%')					
--				AND (servicechargeselectviewlist.idclient = @idclient) 
---				AND (servicechargeselectviewlist.department_code = @iddepartment) 
--				AND (servicechargeselectviewlist.tagdelete = N'N') 
--				AND (servicecharge.employee_id IS NULL) OR (servicechargeselectviewlist.idclient = @idclient) 
--				AND (servicechargeselectviewlist.department_code = @iddepartment) 
--				AND (servicechargeselectviewlist.tagdelete = N'N') 
--				AND (servicecharge.employee_id IS NULL) 


	
IF (@status IS NOT NULL OR @status <> '')
Begin

  	SELECT        dbo.employee.employee_id, dbo.Employee.lname, dbo.Employee.fname, dbo.Employee.mname, dbo.Employee.dailyrate, dbo.Employee.idclient, dbo.client_branch_position.jobposition, dbo.Department.Department_desc, 
                         dbo.client.companyname, dbo.Employee.department_code, dbo.Employee.typeofcontract, dbo.Employee.tagdelete, dbo.Employee.Position1, dbo.Employee.paythrough, dbo.Employee.bankaccountno, 
                         dbo.Employee.employee_status, dbo.Employee.bankname, dbo.Employee.status, dbo.Employee.tempforthirteenmonthstatus, dbo.servicecharge.payoutdate, dbo.servicecharge.fromdate, dbo.servicecharge.enddate
	FROM            dbo.Employee INNER JOIN
                         dbo.client ON dbo.Employee.idclient = dbo.client.idclient INNER JOIN
                         dbo.client_branch_position ON dbo.Employee.Position1 = dbo.client_branch_position.idbranchposition INNER JOIN
                         dbo.Department ON dbo.Employee.department_code = dbo.Department.iddepartment LEFT OUTER JOIN
                         dbo.servicecharge ON dbo.Employee.Employee_id = dbo.servicecharge.employee_id
						 AND employee.idclient = servicecharge.idclient
						 AND servicecharge.fromdate = @datefrom
						 AND servicecharge.enddate = @enddate
		
		wHERE (Employee.lname LIKE + N'%' + @keytext + N'%') or (Employee.Fname LIKE + N'%' + @keytext + N'%')
		and (tempforthirteenmonthstatus = @status)
		AND (client.idclient = @idclient ) 
		
		--WHERE (employee.department_code = @iddepartment) 
		--AND (client.idclient = @idclient) 
		--AND (employee.tagdelete = 'N')
		--and (tempforthirteenmonthstatus = @status)
		--AND	(servicecharge.Employee_id IS NULL)
		ORDER BY employee.lname, employee.fname



End

  */


END
