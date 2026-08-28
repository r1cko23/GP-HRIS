-- =============================================
-- Author:		<Pat Relos>
-- Create date: <6-21-2024>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
CREATE PROCEDURE [dbo].[SPlistofdeduction]	
-- Add the parameters for the stored procedure here
		
	@idclient int,
	@particular nvarchar(100),
	@employeeid nvarchar(100),
	@fromdate date,
	@enddate date

	   
AS


BEGIN

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	
SELECT        client.companyname, payroll_summary.departmentdesc2 , payroll_summary.Employee_id, Employee.lname, Employee.fname, Employee.mname, Employee.date_birth,Employee.pagibigno,employee.SSSno,otherdeduction.amount, otherdeduction.Date_Start, otherdeduction.Date_End, payroll_summary.payrolldate, otherdeduction.particular
FROM            client INNER JOIN
                         Employee INNER JOIN
                         otherdeduction INNER JOIN
                         payroll_summary ON otherdeduction.idpayrollsum = payroll_summary.idpayrollsum ON Employee.Employee_id = otherdeduction.employee_id ON client.idclient = otherdeduction.idclientdeduction
						 WHERE payroll_summary.idclientp = COALESCE(NULLIF(@idclient, ''), payroll_summary.idclientp)	
						 AND (otherdeduction.particular = CASE WHEN @particular ='' then otherdeduction.particular ELSE @particular END)
						 AND (payroll_summary.employee_id = CASE WHEN @employeeid ='' then payroll_summary.employee_id ELSE @employeeid END)
						AND (
        payroll_summary.payrolldate IS NULL 
        OR (
            (@fromdate IS NULL OR @fromdate = '' OR payroll_summary.payrolldate >= @fromdate)
            AND 
            (@enddate IS NULL OR @enddate = '' OR payroll_summary.payrolldate <= @enddate)
        )
    )
		 
			
						
					
						 

--SELECT        payroll_summary.Employee_id, payroll_summary.Date_Start, payroll_summary.Date_End, payroll_summary.payrolldate, Employee.lname, Employee.fname, Employee.mname, Employee.date_birth, Employee.datehired, 
---                        payroll_summary.netamount, payroll_summary.payrollpaytype,payroll_summary.payrollstatus, payroll_summary.payrollatmno,payroll_summary.empchequeno,payroll_summary.empmoneyxferno
--FROM            Employee INNER JOIN
 --                        payroll_summary ON Employee.Employee_id = payroll_summary.Employee_id

--		WHERE (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) 
--		AND (payroll_summary.department_codep= CASE WHEN @iddepartment ='' then department_codep ELSE  @iddepartment END)
--		AND (payroll_summary.Date_Start = CASE WHEN @datestart ='' then Date_Start ELSE  CONVERT(DATETIME, @datestart, 102)END)
--		AND (payroll_summary.payrolldate = CASE WHEN @payout ='' then payrolldate ELSE  CONVERT(DATETIME, @payout, 102)END)
--		AND (payroll_summary.payrollpaytype = CASE WHEN @paytype ='' then payrollpaytype ELSE @paytype END)
--		AND (payroll_summary.payrollstatus = CASE WHEN @payrollstatus ='' then payrollstatus ELSE @payrollstatus END)
		 
			
		 
								 


						

END
