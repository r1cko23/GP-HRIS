-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[payrollselectlist]
	-- Add the parameters for the stored procedure here
		@keytext varchar(50),
		@chkallclient bit,
		@iddepartment int,
		@idclient int,
		@datestart date,
		@chkcurrentclient bit,
		@chkcurrentclientdepartment bit
		
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


	IF (@keytext IS NULL OR @keytext = '') and ((@chkcurrentclientdepartment = 'False'))--null keytext and filter only not in the payrolllist per client per department
    BEGIN
	--get previous list of employee from previous cuttoff exclude the selected employee
		declare @previouscuttoff as date
		SET @previouscuttoff = DATEADD(DAY, -1, @datestart)			
	
		SELECT e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tagdelete, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
		e.paythrough, e.bankaccountno, e.bankname, c.companyname,e.gcash
		FROM Employee AS e INNER JOIN
		client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
		Department AS d ON e.department_code = d.iddepartment INNER JOIN
		client AS c ON e.idclient = c.idclient LEFT OUTER JOIN
		payroll_summary AS ps ON e.Employee_id = ps.Employee_id AND
		e.idclient = ps.idclientp AND 
		ps.Date_Start = @datestart
		WHERE (e.department_code = @iddepartment) 
		AND (cbp.idclient = @idclient) 
		AND (e.tagdelete = 'N') 
		and (e.status = 'Active')		
		AND (ps.Employee_id IS NULL) 
		AND (e.Employee_id IN (SELECT Employee_id
                               FROM payroll_summary
                               WHERE (idclientp = @idclient) AND (Date_End = @previouscuttoff) AND (department_codep = @iddepartment)))
		AND (
        e.verificationstatus IS NULL
        OR e.verificationstatus = 'Verified'
		)

		ORDER BY e.lname, e.fname
	END


	IF (@keytext IS NOT NULL OR @keytext <> '') and ((@chkcurrentclientdepartment = 'False'))--null keytext and filter only not in the payrolllist per client per department
    BEGIN
	--get previous list of employee from previous cuttoff exclude the selected employee
		declare @previouscuttoff2 as date
		SET @previouscuttoff = DATEADD(DAY, -1, @datestart)			

SELECT        e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tagdelete, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
                         e.paythrough, e.bankaccountno, e.bankname, c.companyname,e.gcash
FROM            Employee AS e INNER JOIN
                         client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
                         Department AS d ON e.department_code = d.iddepartment INNER JOIN
                         client AS c ON e.idclient = c.idclient LEFT OUTER JOIN
                         payroll_summary AS ps ON e.Employee_id = ps.Employee_id AND e.idclient = ps.idclientp AND ps.Date_Start = @datestart
			
					WHERE
(
    (
        e.department_code = @iddepartment
        AND cbp.idclient = @idclient
        AND e.tagdelete = 'N'
        AND e.status = 'Active'
        AND ps.Employee_id IS NULL
        AND e.Employee_id IN
        (
            SELECT Employee_id
            FROM payroll_summary
            WHERE idclientp = @idclient
              AND Date_End = @previouscuttoff
              AND department_codep = @iddepartment
        )
        AND
        (
            e.lname LIKE '%' + @keytext + '%'
            OR e.fname LIKE '%' + @keytext + '%'
        )
    )
)
AND
(
    e.verificationstatus IS NULL
    OR e.verificationstatus = 'Verified'
)
ORDER BY e.lname, e.fname;
	END






	--get the all selected client exclude the selected employee
	
	IF (@keytext IS NULL OR @keytext = '') and ((@chkcurrentclientdepartment = 'True')) --filter 
	Begin
		

		/*Below Include Filtering of Department*/
SELECT        e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
                         e.paythrough, e.bankaccountno, c.companyname, e.bankname, e.tagdelete,e.gcash
FROM            Employee AS e INNER JOIN
                         client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
                         Department AS d ON e.department_code = d.iddepartment INNER JOIN
                         client AS c ON e.idclient = c.idclient
WHERE        (e.department_code = @iddepartment) 
				AND (cbp.idclient = @idclient) 
				AND (e.status = 'Active') 
				
				AND (e.Employee_id NOT IN
                             (SELECT        TOP (1) Employee_id
                               FROM            payroll_summary AS ps
                               WHERE        (Employee_id = e.Employee_id) AND (idclientp = e.idclient) AND (Date_Start = @datestart))) AND (e.tagdelete = N'N') 
			 
			   AND
        (
            e.lname LIKE '%' + @keytext + '%'
            OR e.fname LIKE '%' + @keytext + '%'
        )
				 
				 
				 
				 AND (
					e.verificationstatus IS NULL
					OR e.verificationstatus = 'Verified'
					)
	ORDER BY e.lname, e.fname
	END
	




	IF (@keytext IS NOT NULL OR @keytext <> '') and ((@chkcurrentclientdepartment = 'True')) --filter 

	BEGIN 
	
		SELECT        e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
                         e.paythrough, e.bankaccountno, c.companyname, e.bankname, e.tagdelete,e.gcash
	
	FROM            Employee AS e INNER JOIN
                         client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
                         Department AS d ON e.department_code = d.iddepartment INNER JOIN
                         client AS c ON e.idclient = c.idclient LEFT OUTER JOIN
                         payroll_summary AS ps ON e.Employee_id = ps.Employee_id AND e.idclient = ps.idclientp AND ps.Date_Start = @datestart
	WHERE
    e.department_code = @iddepartment
    AND cbp.idclient = @idclient
    AND e.tagdelete = 'N'
    AND e.status = 'Active'
	AND( e.verificationstatus IS NULL  OR e.verificationstatus = 'Verified')
	AND e.lname LIKE '%' + @keytext + '%' OR e.fname LIKE '%' + @keytext + '%'
	--AND ps.Employee_id IS NULL
    AND e.Employee_id IN
    (
        SELECT Employee_id
        FROM payroll_summary
        WHERE idclientp = @idclient
       --   AND Date_End = @previouscuttoff2
          AND department_codep = @iddepartment
    )
    --AND
    --(
    --    e.lname LIKE '%' + @keytext + '%'
    --    OR e.fname LIKE '%' + @keytext + '%'
    --)
    

			ORDER BY e.lname, e.fname
	
	END 




	
	/*Below Filter only Client
		SELECT  e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
        e.paythrough, e.bankaccountno, c.companyname, e.bankname
	FROM            Employee AS e INNER JOIN
                       client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
                         Department AS d ON e.department_code = d.iddepartment INNER JOIN
                         client AS c ON e.idclient = c.idclient
	WHERE        (cbp.idclient = @idclient) AND (e.status = 'Active') AND (e.Employee_id NOT IN
                             (SELECT        TOP (1) Employee_id
                              FROM            payroll_summary AS ps
                               WHERE        (Employee_id = e.Employee_id) AND (idclientp = e.idclient) AND (Date_Start = @datestart))) OR
                         (cbp.idclient = @idclient) AND (e.status = 'Active') AND (e.Employee_id NOT IN
                             (SELECT        TOP (1) Employee_id
                               FROM            payroll_summary AS ps
                               WHERE        (Employee_id = e.Employee_id) AND (idclientp = e.idclient) AND (Date_Start = @datestart))) OR
                         (cbp.idclient = @idclient) AND (e.status = 'Active') AND (e.Employee_id NOT IN
                             (SELECT        TOP (1) Employee_id
                               FROM            payroll_summary AS ps
                               WHERE        (Employee_id = e.Employee_id) AND (idclientp = e.idclient) AND (Date_Start = @datestart)))
	ORDER BY e.lname, e.fname


	
	End






	IF (@keytext Is Not NULL OR @keytext <> '') and ((@chkcurrentclient = 'True') AND (@chkallclient = 'False'))
	Begin
		SELECT        e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tagdelete, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, e.departmentsub, 
                         e.paythrough, e.bankaccountno, e.bankname, c.companyname
		FROM            Employee AS e INNER JOIN
                         client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
                         Department AS d ON e.department_code = d.iddepartment INNER JOIN
                         client AS c ON e.idclient = c.idclient LEFT OUTER JOIN
                         payroll_summary AS ps ON e.Employee_id = ps.Employee_id AND e.idclient = ps.idclientp AND ps.Date_Start = @datestart
			WHERE        (e.department_code = @iddepartment) AND (cbp.idclient = @idclient) AND (e.status = 'Active') AND (e.tagdelete = 'N') AND (ps.Employee_id IS NULL) AND (e.fname LIKE N'%' + @keytext + N'%') OR
                         (e.department_code = @iddepartment) AND (e.status = N'Active') AND (e.tagdelete = N'N') AND (e.lname LIKE N'%' + @keytext + N'%') OR
                         (e.department_code = @iddepartment) AND (e.status = N'Active') AND (e.tagdelete = N'N') AND (cbp.jobposition LIKE N'%' + @keytext + N'%')
		
		
		
		ORDER BY e.lname, e.fname
		
	End



	IF (@keytext Is Not NULL OR @keytext <> '') and ((@chkcurrentclient = 'True') AND (@chkallclient = 'True'))
  	 BEGIN
		SELECT e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tagdelete, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, 
		e.departmentsub, e.paythrough, e.bankaccountno, e.bankname, c.companyname
		FROM Employee AS e INNER JOIN
		client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
		Department AS d ON e.department_code = d.iddepartment INNER JOIN
		client AS c ON e.idclient = c.idclient
		WHERE (e.status = 'Active') AND (e.tagdelete = 'N') AND (e.fname LIKE '%' + @keytext + '%') OR
			  (e.status = 'Active') AND (e.tagdelete = 'N') AND (e.lname LIKE '%' + @keytext + '%') OR
			  (e.status = 'Active') AND (e.tagdelete = 'N') AND (cbp.jobposition LIKE '%' + @keytext + '%')
		ORDER BY e.lname, e.fname
	END

	*/
END

