-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-8-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[thirteenmonthselectlist]
	-- Add the parameters for the stored procedure here
		@keytext varchar(50),
		--@chkallclient bit,
		@iddepartment int,
		@idclient int,
		@status varchar(20),
		@thirteenyear varchar(4),
		@payoutdate nvarchar(20)
				
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
WHERE        (payroll_summary.payrolldate = @payoutdate) AND (payroll_summary.idclientp = @idclient)



IF (@status IS NULL OR @status = '')
Begin
SELECT        thirteenmonthselecviewlist.Employee_id, 
				thirteenmonthselecviewlist.daysin, 
				thirteenmonthselecviewlist.maxdrate, 
				thirteenmonthselecviewlist.noofmonths, 
				thirteenmonthselecviewlist.SumOfbasic, 
                         thirteenmonthselecviewlist.lname, 
						 thirteenmonthselecviewlist.fname, 
						 thirteenmonthselecviewlist.mname, 
						 thirteenmonthselecviewlist.dailyrate, 
						 thirteenmonthselecviewlist.idclient, 
						 thirteenmonthselecviewlist.jobposition, 
                         thirteenmonthselecviewlist.Department_desc, 
						 thirteenmonthselecviewlist.companyname, 
						 thirteenmonthselecviewlist.department_code, 
						 thirteenmonthselecviewlist.typeofcontract, 
						 thirteenmonthselecviewlist.tagdelete, 
                         thirteenmonthselecviewlist.Position1, 
						 thirteenmonthselecviewlist.paythrough, 
						 thirteenmonthselecviewlist.bankaccountno, 
						 thirteenmonthselecviewlist.employee_status, 
						 thirteenmonthselecviewlist.bankname, 
                         thirteenmonthselecviewlist.tempforthirteenmonthstatus, 
						 View_thirteenmonth.employee_id AS employee_id2
FROM            thirteenmonthselecviewlist FULL OUTER JOIN
                         View_thirteenmonth ON thirteenmonthselecviewlist.Employee_id = View_thirteenmonth.employee_id

WHERE        (thirteenmonthselecviewlist.thirteenmonthyear = @thirteenyear) 
AND (thirteenmonthselecviewlist.department_code = @iddepartment) 
AND (thirteenmonthselecviewlist.idclient = @idclient) 
AND (thirteenmonthselecviewlist.tagdelete = 'N') 
AND (View_thirteenmonth.employee_id IS NULL) 
AND (thirteenmonthselecviewlist.fname LIKE + '%' + @keytext + '%') OR (thirteenmonthselecviewlist.thirteenmonthyear = @thirteenyear) 
AND (thirteenmonthselecviewlist.department_code = @iddepartment) 
AND (thirteenmonthselecviewlist.idclient = @idclient) 
AND  (thirteenmonthselecviewlist.tagdelete = N'N') 
AND (View_thirteenmonth.employee_id IS NULL)
AND (thirteenmonthselecviewlist.lname LIKE + N'%' + @keytext + N'%')

ORDER BY thirteenmonthselecviewlist.lname, thirteenmonthselecviewlist.fname DESC
	End
	
	IF (@status IS NOT NULL OR @status <> '')
	Begin
	SELECT        thirteenmonthselecviewlist.Employee_id, thirteenmonthselecviewlist.daysin, thirteenmonthselecviewlist.maxdrate, thirteenmonthselecviewlist.noofmonths, thirteenmonthselecviewlist.SumOfbasic, 
                         thirteenmonthselecviewlist.lname, thirteenmonthselecviewlist.fname, thirteenmonthselecviewlist.mname, thirteenmonthselecviewlist.dailyrate, thirteenmonthselecviewlist.idclient, thirteenmonthselecviewlist.jobposition, 
                         thirteenmonthselecviewlist.Department_desc, thirteenmonthselecviewlist.companyname, thirteenmonthselecviewlist.department_code, thirteenmonthselecviewlist.typeofcontract, thirteenmonthselecviewlist.tagdelete, 
                         thirteenmonthselecviewlist.Position1, thirteenmonthselecviewlist.paythrough, thirteenmonthselecviewlist.bankaccountno, thirteenmonthselecviewlist.employee_status, thirteenmonthselecviewlist.bankname, 
                         thirteenmonthselecviewlist.tempforthirteenmonthstatus, thirteenmonth.employee_id AS employee_id2
FROM            thirteenmonthselecviewlist FULL OUTER JOIN
                         thirteenmonth ON thirteenmonthselecviewlist.Employee_id = thirteenmonth.employee_id
WHERE        (thirteenmonthselecviewlist.thirteenmonthyear = @thirteenyear) AND (thirteenmonthselecviewlist.tempforthirteenmonthstatus = @status) AND (thirteenmonthselecviewlist.department_code = @iddepartment) AND 
                         (thirteenmonthselecviewlist.idclient = @idclient) AND (thirteenmonthselecviewlist.tagdelete = 'N') AND (thirteenmonth.employee_id IS NULL) AND (thirteenmonthselecviewlist.fname LIKE + '%' + @keytext + '%') OR
                         (thirteenmonthselecviewlist.thirteenmonthyear = @thirteenyear) AND (thirteenmonthselecviewlist.tempforthirteenmonthstatus = @status) AND (thirteenmonthselecviewlist.department_code = @iddepartment) AND 
                         (thirteenmonthselecviewlist.idclient = @idclient) AND (thirteenmonthselecviewlist.tagdelete = N'N') AND (thirteenmonth.employee_id IS NULL) AND (thirteenmonthselecviewlist.lname LIKE + N'%' + @keytext + N'%')
ORDER BY thirteenmonthselecviewlist.lname, thirteenmonthselecviewlist.fname DESC
	End




END
